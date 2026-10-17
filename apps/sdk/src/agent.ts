/**
 * `HaloraAgent`: the agent side. Pays within policy, requests owner approval when needed, and
 * pays x402 resources. See docs/architecture/interfaces.md section 4.
 *
 * Every payment is a `token.transfer(from = account, to, amount)` authorized by the account's
 * `__check_auth` with a `HaloraSignature::Agent` credential signed by the agent key. The local
 * pre-flight only gives early, typed errors; the contract is the source of truth.
 */

import { Address, Keypair } from '@stellar/stellar-sdk';
import {
  AddressSchema,
  ContractIdSchema,
  HaloraPolicyError,
  evaluateAgentPayment,
  isAccountId,
  isContractId,
  isSecretSeed,
  type ApprovalPending,
  type Network,
  type OnChainApproval,
  type PaymentResult,
  type Policy,
} from '@halora/shared';
import { HaloraApiClient, assertSecureUrl, type FetchLike } from './api.js';
import { HaloraClient } from './client.js';
import { HaloraApprovalError, HaloraSdkError } from './errors.js';
import { assembleWithAuth, invokeWithHaloraAuth, prepareHaloraInvocation } from './invoke.js';
import { toI128 } from './scval.js';
import type { HaloraRpc } from './tx.js';
import { createX402Fetch, X402Error, type X402PaymentEvent } from './x402/fetch.js';
import { ledgerTimeout, selectStellarRequirement } from './x402/stellar.js';
import type { PaymentRequirements } from './x402/types.js';

export type HaloraAgentOptions = {
  contractId: string;
  /** Agent ed25519 secret seed (S...). Never logged or sent anywhere. */
  agentSecret: string;
  network: Network;
  rpcUrl?: string;
  apiUrl?: string;
  apiKey?: string;
  /** Inject an RPC implementation (tests, custom transport). */
  rpc?: HaloraRpc;
  /** Inject fetch (tests, custom transport). Used for the API and for x402. */
  fetch?: FetchLike;
  /** Optional extra cap for a single x402 payment, in base units, on top of the policy. */
  maxX402Amount?: bigint;
  /** Called after each x402 paid retry. */
  onX402Payment?: (event: X402PaymentEvent) => void | Promise<void>;
  /** Ledgers a direct-payment agent signature stays valid (default 12, about 1 minute). */
  authValidForLedgers?: number;
  /** Approval polling interval (default 3 s). */
  approvalPollIntervalMs?: number;
  confirmTimeoutMs?: number;
  pollIntervalMs?: number;
  /** Clock override for tests (unix seconds). */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

type Preflight = {
  policy: Policy;
  spentToday: bigint;
  approval: OnChainApproval | null;
  requiresApproval: boolean;
};

export class HaloraAgent {
  readonly contractId: string;
  readonly network: Network;
  readonly publicKey: string;
  private readonly keypair: Keypair;
  private readonly client: HaloraClient;
  private readonly api?: HaloraApiClient;
  private readonly opts: HaloraAgentOptions;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: HaloraAgentOptions) {
    this.contractId = ContractIdSchema.parse(opts.contractId);
    if (!isSecretSeed(opts.agentSecret)) {
      // Do not include the value in the message.
      throw new HaloraSdkError('agentSecret is not a valid Stellar secret seed');
    }
    this.keypair = Keypair.fromSecret(opts.agentSecret);
    this.publicKey = this.keypair.publicKey();
    this.network = opts.network;
    this.opts = opts;
    this.client = new HaloraClient({
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      rpc: opts.rpc,
      apiUrl: opts.apiUrl,
      confirmTimeoutMs: opts.confirmTimeoutMs,
      pollIntervalMs: opts.pollIntervalMs,
    });
    if (opts.apiUrl || opts.apiKey) {
      if (!opts.apiUrl || !opts.apiKey) {
        throw new HaloraSdkError('apiUrl and apiKey must be provided together');
      }
      assertSecureUrl(opts.apiUrl, 'apiUrl');
      this.api = new HaloraApiClient({
        apiUrl: opts.apiUrl,
        apiKey: opts.apiKey,
        fetch: opts.fetch,
      });
    }
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Read-only client for views (policy, balance, spent today). */
  get views(): HaloraClient {
    return this.client;
  }

  /**
   * Local policy check against current on-chain state. Throws `HaloraPolicyError` on denial.
   * Fails closed: if any state cannot be read, the error propagates and nothing is signed.
   */
  async preflight(to: string, amount: bigint): Promise<Preflight> {
    const [policy, spentToday, approval] = await Promise.all([
      this.client.getPolicy(this.contractId),
      this.client.getSpentToday(this.contractId),
      this.client.getApproval(this.contractId, to),
    ]);
    const result = evaluateAgentPayment({
      policy,
      token: policy.token,
      to,
      amount,
      spentToday,
      nowSeconds: this.now(),
      approval,
    });
    if (!result.allowed) throw new HaloraPolicyError(result.code);
    return { policy, spentToday, approval, requiresApproval: result.requiresApproval };
  }

  /**
   * Pays `amount` base units of the policy token to `to`. The agent account (G...) is the
   * transaction source and pays the network fee, so it must exist and hold some XLM.
   * Above the approval threshold without a pre-approval, creates an approval request through
   * the API and returns `ApprovalPending` (or throws `ApprovalRequired` without an API).
   */
  async pay(opts: {
    to: string;
    amount: bigint;
    reason?: string;
  }): Promise<PaymentResult | ApprovalPending> {
    const to = validateRecipient(opts.to);
    const amount = validateAmount(opts.amount);
    const pre = await this.preflight(to, amount);
    if (pre.requiresApproval) {
      if (!this.api) {
        throw new HaloraPolicyError(
          'ApprovalRequired',
          'Configure apiUrl and apiKey to request owner approval, or ask the owner to call approve_payment.',
        );
      }
      const request = await this.api.createApproval({
        contractId: this.contractId,
        token: pre.policy.token,
        to,
        amount: amount.toString(10),
        reason: opts.reason ?? '',
      });
      return {
        status: 'approval_pending',
        approvalId: request.id,
        contractId: this.contractId,
        to,
        amount: amount.toString(10),
        expiresAt: request.expiresAt,
      };
    }
    const result = await invokeWithHaloraAuth({
      ctx: this.client.txContext,
      contractId: this.contractId,
      callContract: pre.policy.token,
      method: 'transfer',
      args: transferArgs(this.contractId, to, amount),
      role: 'Agent',
      signer: this.keypair,
      sourcePublicKey: this.publicKey,
      feePayer: this.keypair,
      validForLedgers: this.opts.authValidForLedgers ?? 12,
    });
    return {
      status: 'paid',
      contractId: this.contractId,
      token: pre.policy.token,
      to,
      amount: amount.toString(10),
      txHash: result.txHash,
      ledger: result.ledger,
    };
  }

  /**
   * Polls the API until the owner approves (on-chain `approve_payment`), then retries the same
   * payment, which consumes the pre-approval. Throws `HaloraApprovalError` when the request is
   * rejected, expires, or polling times out.
   */
  async waitForApproval(id: string, opts: { timeoutMs?: number } = {}): Promise<PaymentResult> {
    if (!this.api) throw new HaloraSdkError('apiUrl and apiKey are required to wait for approvals');
    const timeoutMs = opts.timeoutMs ?? 15 * 60_000;
    const interval = this.opts.approvalPollIntervalMs ?? 3_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const req = await this.api.getApproval(id);
      if (req.contractId !== this.contractId) {
        throw new HaloraApprovalError(id, req.status, 'approval belongs to a different account');
      }
      if (req.status === 'approved') {
        const result = await this.pay({ to: req.to, amount: BigInt(req.amount) });
        if (result.status !== 'paid') {
          throw new HaloraApprovalError(
            id,
            req.status,
            'approval is marked approved but no valid on-chain pre-approval was found',
          );
        }
        return result;
      }
      if (req.status !== 'pending') throw new HaloraApprovalError(id, req.status);
      if (Date.now() >= deadline) {
        throw new HaloraApprovalError(id, 'timeout', `timed out waiting for approval ${id}`);
      }
      await this.sleep(interval);
    }
  }

  /**
   * x402-aware fetch. On HTTP 402 (x402 v2, Stellar `exact` scheme) it signs only the Soroban
   * authorization entry for `transfer(account, payTo, amount)` with the agent key and retries
   * once with `PAYMENT-SIGNATURE`. The facilitator submits and pays the fee, so the agent needs
   * no XLM in this mode. Payments above the threshold need an on-chain pre-approval for payTo.
   */
  fetch(input: string | URL, init?: RequestInit): Promise<Response> {
    let token: string | undefined;
    const x402 = createX402Fetch({
      fetch: this.opts.fetch,
      onPayment: this.opts.onX402Payment,
      signer: {
        select: async (accepts) => {
          token = (await this.client.getPolicy(this.contractId)).token;
          return selectStellarRequirement(accepts, this.network, token);
        },
        createPayload: async (req) => ({ transaction: await this.signX402(req, token) }),
      },
    });
    return x402(input, init);
  }

  /** Builds the x402 `payload.transaction` (base64 XDR) for a Stellar `exact` requirement. */
  async signX402(req: PaymentRequirements, expectedToken?: string): Promise<string> {
    if (req.scheme !== 'exact') throw new X402Error('only the exact scheme is supported');
    const payTo = validateRecipient(req.payTo);
    const amount = validateAmount(BigInt(req.amount));
    if (this.opts.maxX402Amount !== undefined && amount > this.opts.maxX402Amount) {
      throw new X402Error('x402 amount exceeds the configured maxX402Amount');
    }
    const pre = await this.preflight(payTo, amount);
    if (req.asset !== pre.policy.token || (expectedToken && expectedToken !== pre.policy.token)) {
      throw new HaloraPolicyError('UnsupportedCall', 'x402 asset is not the policy token.');
    }
    if (pre.requiresApproval) {
      throw new HaloraPolicyError(
        'ApprovalRequired',
        'x402 payments above the threshold need an on-chain pre-approval (approve_payment) for this recipient.',
      );
    }
    const ctx = this.client.txContext;
    const prepared = await prepareHaloraInvocation({
      ctx,
      contractId: this.contractId,
      callContract: pre.policy.token,
      method: 'transfer',
      args: transferArgs(this.contractId, payTo, amount),
      role: 'Agent',
      signer: this.keypair,
      sourcePublicKey: this.publicKey,
      validForLedgers: ledgerTimeout(req.maxTimeoutSeconds),
      allowUnfundedSource: true,
    });
    // Enforcing simulation runs __check_auth now, so a policy denial surfaces before we hand
    // anything to the resource server. The envelope is left unsigned: the facilitator rebuilds
    // the transaction with its own source account and fee.
    const tx = await assembleWithAuth(ctx, this.contractId, prepared, prepared.auth);
    return tx.toXDR();
  }
}

function transferArgs(from: string, to: string, amount: bigint) {
  return [new Address(from).toScVal(), new Address(to).toScVal(), toI128(amount)];
}

function validateRecipient(to: string): string {
  const parsed = AddressSchema.parse(to);
  if (!isAccountId(parsed) && !isContractId(parsed)) throw new HaloraSdkError('invalid recipient');
  return parsed;
}

function validateAmount(amount: bigint): bigint {
  if (typeof amount !== 'bigint' || amount <= 0n) {
    throw new HaloraSdkError('amount must be a positive bigint in base units');
  }
  return amount;
}
