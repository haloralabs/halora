/**
 * In-memory stand-in for Soroban RPC plus a `halora-account` model, used only in tests.
 * It mirrors the contract's documented behavior (interfaces.md section 1) closely enough to
 * exercise the SDK's simulate, sign, enforce-simulate and submit flow without a network.
 */

import type { Keypair } from '@stellar/stellar-sdk';
import {
  Account,
  Address,
  SorobanDataBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  type FeeBumpTransaction,
  type Transaction,
  type rpc,
} from '@stellar/stellar-sdk';
import {
  HALORA_ERRORS,
  evaluateAgentPayment,
  type OnChainApproval,
  type Policy,
} from '@halora/shared';
import { getAuthEntryAddress, getAuthEntryPayload, getAddressCredentials } from '../src/auth.js';
import {
  decodeHaloraSignature,
  decodePolicy,
  encodeApproval,
  encodePolicy,
  publicKeyToBytesN,
} from '../src/scval.js';
import type { HaloraRpc } from '../src/tx.js';

export const PASSPHRASE = 'Test SDF Network ; September 2015';
// Public test values only. Contract IDs are arbitrary but valid strkeys.
export const CONTRACT_ID = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
export const TOKEN_ID = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';

type Call = { contract: string; fn: string; args: xdr.ScVal[] };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeCall(tx: Transaction): Call | null {
  const op = tx.operations[0];
  if (!op || op.type !== 'invokeHostFunction') throw new Error('not an invoke');
  const func = op.func;
  if (func.type !== 'hostFunctionTypeInvokeContract') return null;
  const ic = func.invokeContract;
  return {
    contract: Address.fromScAddress(ic.contractAddress).toString(),
    fn: ic.functionName.toString(),
    args: ic.args,
  };
}

export class FakeLedger implements HaloraRpc {
  latestLedger = 1_000;
  nowSeconds = 1_800_000_000;
  policy: Policy;
  spentToday = 0n;
  approvals = new Map<string, OnChainApproval>();
  unfunded = new Set<string>();
  submitted: Transaction[] = [];
  simulations: { fn: string; authMode?: string; authCount: number }[] = [];
  deployReturn?: string;
  private pending = new Map<string, xdr.ScVal | undefined>();
  private nonce = 1n;

  constructor(
    readonly owner: Keypair,
    readonly agent: Keypair,
    policy: Partial<Policy> = {},
  ) {
    this.policy = {
      token: TOKEN_ID,
      perTxLimit: '100000000',
      dailyLimit: '500000000',
      approvalThreshold: '50000000',
      allowlistEnabled: false,
      allowlist: [],
      expiresAt: 0,
      paused: false,
      ...policy,
    };
  }

  async getAccount(address: string): Promise<Account> {
    if (this.unfunded.has(address)) throw new Error('Account not found');
    return new Account(address, '100');
  }

  async getLatestLedger() {
    return {
      id: 'x',
      sequence: this.latestLedger,
      protocolVersion: 25,
    } as unknown as rpc.Api.GetLatestLedgerResponse;
  }

  private success(retval: xdr.ScVal | undefined, auth: xdr.SorobanAuthorizationEntry[] = []) {
    return {
      _parsed: true,
      id: '1',
      latestLedger: this.latestLedger,
      events: [],
      transactionData: new SorobanDataBuilder(),
      minResourceFee: '100',
      result: { auth, retval: retval ?? xdr.ScVal.scvVoid() },
    } as unknown as rpc.Api.SimulateTransactionResponse;
  }

  private error(message: string) {
    return {
      _parsed: true,
      id: '1',
      latestLedger: this.latestLedger,
      events: [],
      error: message,
    } as unknown as rpc.Api.SimulateTransactionResponse;
  }

  private contractError(code: number) {
    return this.error(
      `HostError: Error(Auth, InvalidAction)\n\nEvent log (newest first):\n` +
        `  0: [Diagnostic Event] contract:${CONTRACT_ID}, topics:[error, Error(Contract, #${code})], data:"check_auth"`,
    );
  }

  async simulateTransaction(
    tx: Transaction | FeeBumpTransaction,
    _resources?: unknown,
    authMode?: rpc.Api.SimulationAuthMode,
  ): Promise<rpc.Api.SimulateTransactionResponse> {
    const t = tx as Transaction;
    const op = t.operations[0];
    if (!op || op.type !== 'invokeHostFunction') throw new Error('not an invoke');
    const auth = op.auth ?? [];
    const call = decodeCall(t);
    this.simulations.push({ fn: call?.fn ?? 'deploy', authMode, authCount: auth.length });
    if (!call) {
      return this.success(
        this.deployReturn ? new Address(this.deployReturn).toScVal() : undefined,
        [
          new xdr.SorobanAuthorizationEntry({
            credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
            rootInvocation: new xdr.SorobanAuthorizedInvocation({
              function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
                new xdr.InvokeContractArgs({
                  contractAddress: new Address(CONTRACT_ID).toScAddress(),
                  functionName: '__constructor',
                  args: [],
                }),
              ),
              subInvocations: [],
            }),
          }),
        ],
      );
    }
    const view = this.view(call);
    if (view !== undefined) return this.success(view);

    const needsAccountAuth =
      (call.contract === TOKEN_ID && call.fn === 'transfer') || call.contract === CONTRACT_ID;
    if (!needsAccountAuth) return this.error('unknown call');

    if (auth.length === 0) {
      // Recording mode: return an unsigned address-credential entry for the account.
      const entry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
          new xdr.SorobanAddressCredentials({
            address: new Address(CONTRACT_ID).toScAddress(),
            nonce: this.nonce++,
            signatureExpirationLedger: 0,
            signature: xdr.ScVal.scvVoid(),
          }),
        ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: new Address(call.contract).toScAddress(),
              functionName: call.fn,
              args: call.args,
            }),
          ),
          subInvocations: [],
        }),
      });
      return this.success(undefined, [entry]);
    }

    // Enforcing mode: model __check_auth.
    const code = this.checkAuth(auth, call);
    if (code !== 0) return this.contractError(code);
    return this.success(undefined);
  }

  private view(call: Call): xdr.ScVal | undefined {
    if (call.contract === TOKEN_ID && call.fn === 'balance') {
      return nativeToScVal(1_000_000_000n, { type: 'i128' });
    }
    if (call.contract !== CONTRACT_ID) return undefined;
    switch (call.fn) {
      case 'policy':
        return encodePolicy(this.policy);
      case 'spent_today':
        return nativeToScVal(this.spentToday, { type: 'i128' });
      case 'owner':
        return publicKeyToBytesN(this.owner.publicKey());
      case 'agent':
        return publicKeyToBytesN(this.agent.publicKey());
      case 'approval': {
        const to = Address.fromScVal(call.args[0]!).toString();
        const a = this.approvals.get(to);
        return a ? encodeApproval(a) : xdr.ScVal.scvVoid();
      }
      default:
        return undefined;
    }
  }

  /** Returns 0 when authorized, else the contract error code. */
  private checkAuth(auth: xdr.SorobanAuthorizationEntry[], call: Call): number {
    const entry = auth.find((e) => getAuthEntryAddress(e) === CONTRACT_ID);
    if (!entry) return HALORA_ERRORS.InvalidSignature.code;
    const creds = getAddressCredentials(entry)!;
    if (creds.signatureExpirationLedger <= this.latestLedger) {
      return HALORA_ERRORS.InvalidSignature.code;
    }
    const payload = getAuthEntryPayload(entry, PASSPHRASE);
    const sig = decodeHaloraSignature(creds.signature);
    const verify = (s: { publicKey: Uint8Array; signature: Uint8Array }, kp: Keypair) =>
      toHex(s.publicKey) === toHex(kp.rawPublicKey()) && kp.verify(payload, s.signature);
    if (sig.kind === 'Owner') {
      return verify(sig.owner, this.owner) ? 0 : HALORA_ERRORS.InvalidSignature.code;
    }
    const agentOk = verify(sig.agent, this.agent);
    const ownerOk = sig.kind === 'AgentWithOwner' && verify(sig.owner, this.owner);
    if (!agentOk || (sig.kind === 'AgentWithOwner' && !ownerOk)) {
      return HALORA_ERRORS.InvalidSignature.code;
    }
    if (call.contract !== this.policy.token || call.fn !== 'transfer') {
      return HALORA_ERRORS.UnsupportedCall.code;
    }
    const from = Address.fromScVal(call.args[0]!).toString();
    if (from !== CONTRACT_ID) return HALORA_ERRORS.UnsupportedCall.code;
    const to = Address.fromScVal(call.args[1]!).toString();
    const amount = scValToNative(call.args[2]!) as bigint;
    const r = evaluateAgentPayment({
      policy: this.policy,
      token: call.contract,
      to,
      amount,
      spentToday: this.spentToday,
      nowSeconds: this.nowSeconds,
      approval: this.approvals.get(to) ?? null,
    });
    if (!r.allowed) return HALORA_ERRORS[r.code].code;
    if (r.requiresApproval && !ownerOk) return HALORA_ERRORS.ApprovalRequired.code;
    return 0;
  }

  async sendTransaction(
    tx: Transaction | FeeBumpTransaction,
  ): Promise<rpc.Api.SendTransactionResponse> {
    const t = tx as Transaction;
    this.submitted.push(t);
    const hash = toHex(t.hash());
    const call = decodeCall(t);
    let ret: xdr.ScVal | undefined;
    if (!call) {
      ret = this.deployReturn ? new Address(this.deployReturn).toScVal() : undefined;
    } else if (call.fn === 'transfer') {
      const to = Address.fromScVal(call.args[1]!).toString();
      const amount = scValToNative(call.args[2]!) as bigint;
      this.spentToday += amount;
      if (amount > BigInt(this.policy.approvalThreshold)) this.approvals.delete(to);
    } else if (call.fn === 'set_policy') {
      this.policy = decodePolicy(call.args[0]!);
    } else if (call.fn === 'approve_payment') {
      const to = Address.fromScVal(call.args[0]!).toString();
      this.approvals.set(to, {
        amount: (scValToNative(call.args[1]!) as bigint).toString(),
        expiresAt: Number(scValToNative(call.args[2]!) as bigint),
      });
    } else if (call.fn === 'revoke_approval') {
      this.approvals.delete(Address.fromScVal(call.args[0]!).toString());
    } else if (call.fn === 'pause') {
      this.policy = { ...this.policy, paused: true };
    }
    this.pending.set(hash, ret);
    return {
      status: 'PENDING',
      hash,
      latestLedger: this.latestLedger,
      latestLedgerCloseTime: 0,
    } as unknown as rpc.Api.SendTransactionResponse;
  }

  async getTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse> {
    if (!this.pending.has(hash)) {
      return { status: 'NOT_FOUND' } as unknown as rpc.Api.GetTransactionResponse;
    }
    return {
      status: 'SUCCESS',
      ledger: this.latestLedger + 1,
      returnValue: this.pending.get(hash),
    } as unknown as rpc.Api.GetTransactionResponse;
  }
}
