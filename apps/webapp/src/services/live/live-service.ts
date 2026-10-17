import type {
  AgentOverview,
  ApprovalRequest,
  PaymentRecord,
  Policy,
  PreApproval,
} from '@/lib/domain';
import { isValidRecipient, validatePolicy } from '@/lib/policy';
import {
  DEFAULT_APPROVAL_TTL_SECONDS,
  DataServiceError,
  type ApprovalQuery,
  type CreateAgentInput,
  type CreateAgentResult,
  type HaloraDataService,
  type OwnerSession,
  type PaymentQuery,
  type PreApprovalInput,
} from '../types';
import { HaloraClient } from '@halora/sdk';
import { HaloraApiClient } from './api-client';
import { ChainClient } from './chain';

export type LiveOptions = {
  apiUrl: string;
  rpcUrl: string;
  network: 'testnet' | 'mainnet';
  /** halora-account WASM hash (hex), from @halora/shared contracts JSON. */
  wasmHash: string;
  /** Default policy token (USDC SAC contract ID) for new accounts. */
  usdc: string;
};

/**
 * Live implementation: metadata, payment log and approval requests from the Halora API; policy,
 * spent-today, balance and pre-approvals read directly from the chain, since the contract is the
 * source of truth. Every owner write is a transaction signed in the owner's wallet.
 */
export class LiveDataService implements HaloraDataService {
  readonly mode = 'live' as const;
  private readonly api: HaloraApiClient;
  private readonly chain: ChainClient;
  /** Reads go through @halora/sdk. Owner writes use ChainClient because they are wallet-signed. */
  private readonly sdk: HaloraClient;

  constructor(private readonly opts: LiveOptions) {
    this.api = new HaloraApiClient(opts.apiUrl);
    this.chain = new ChainClient(opts.rpcUrl, opts.network);
    this.sdk = new HaloraClient({
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      apiUrl: opts.apiUrl,
    });
  }

  private async readState(contractId: string) {
    const policy = await this.sdk.getPolicy(contractId);
    const [spentToday, balance] = await Promise.all([
      this.sdk.getSpentToday(contractId).then(String),
      this.sdk.getBalance(contractId, policy.token).then(String, () => null),
    ]);
    return { policy, spentToday, balance };
  }

  async listAgents(owner: OwnerSession): Promise<AgentOverview[]> {
    await this.api.ensureSession(owner);
    const [{ accounts }, { approvals }] = await Promise.all([
      this.api.listAccounts(),
      this.api.listApprovals({ status: 'pending' }),
    ]);
    return Promise.all(
      accounts.map(async (account) => {
        const { policy, spentToday, balance } = await this.readState(account.contractId);
        return {
          account,
          policy,
          spentToday,
          balance,
          pendingApprovals: approvals.filter((a) => a.contractId === account.contractId).length,
        };
      }),
    );
  }

  async getAgent(owner: OwnerSession, contractId: string): Promise<AgentOverview | null> {
    await this.api.ensureSession(owner);
    const { accounts } = await this.api.listAccounts();
    const account = accounts.find((a) => a.contractId === contractId);
    if (!account) return null;
    const [{ policy, spentToday, balance }, pending] = await Promise.all([
      this.readState(contractId),
      this.api.listApprovals({ contractId, status: 'pending' }),
    ]);
    return { account, policy, spentToday, balance, pendingApprovals: pending.approvals.length };
  }

  async createAgent(owner: OwnerSession, input: CreateAgentInput): Promise<CreateAgentResult> {
    const policy = { ...input.policy, token: input.policy.token || this.opts.usdc };
    const problems = validatePolicy(policy);
    if (problems.length > 0) throw new DataServiceError(problems[0]!.message, 'invalid');
    await this.api.ensureSession(owner);
    const contractId = await this.chain.deployAccount(
      owner,
      this.opts.wasmHash,
      input.agentPublicKey,
      policy,
    );
    return this.api.registerAccount({
      label: input.label,
      contractId,
      agentPublicKey: input.agentPublicKey,
      network: this.opts.network,
    });
  }

  async updatePolicy(owner: OwnerSession, contractId: string, policy: Policy): Promise<Policy> {
    const problems = validatePolicy(policy);
    if (problems.length > 0) throw new DataServiceError(problems[0]!.message, 'invalid');
    await this.chain.setPolicy(owner, contractId, policy);
    return this.sdk.getPolicy(contractId);
  }

  async setPaused(owner: OwnerSession, contractId: string, paused: boolean): Promise<Policy> {
    await this.chain.invokeAsOwner(owner, contractId, paused ? 'pause' : 'unpause', []);
    return this.sdk.getPolicy(contractId);
  }

  async listPayments(owner: OwnerSession, query: PaymentQuery = {}): Promise<PaymentRecord[]> {
    await this.api.ensureSession(owner);
    const limit = query.limit ?? 100;
    const ids = query.contractId
      ? [query.contractId]
      : (await this.api.listAccounts()).accounts.map((a) => a.contractId);
    const pages = await Promise.all(ids.map((id) => this.api.listPayments(id, limit)));
    return pages
      .flatMap((p) => p.payments)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async listApprovals(owner: OwnerSession, query: ApprovalQuery = {}): Promise<ApprovalRequest[]> {
    await this.api.ensureSession(owner);
    return (await this.api.listApprovals(query)).approvals;
  }

  async approve(
    owner: OwnerSession,
    approvalId: string,
    opts: { expiresAt?: number } = {},
  ): Promise<ApprovalRequest> {
    await this.api.ensureSession(owner);
    // Re-read the request so the owner signs what the API currently holds, never a stale copy.
    const { approval } = await this.api.getApproval(approvalId);
    if (approval.status !== 'pending') {
      throw new DataServiceError(`This request is already ${approval.status}.`, 'conflict');
    }
    const expiresAt =
      opts.expiresAt ?? Math.floor(Date.now() / 1000) + DEFAULT_APPROVAL_TTL_SECONDS;
    const txHash = await this.chain.approvePayment(
      owner,
      approval.contractId,
      approval.to,
      approval.amount,
      expiresAt,
    );
    return (await this.api.approve(approvalId, txHash)).approval;
  }

  async reject(owner: OwnerSession, approvalId: string, reason?: string): Promise<ApprovalRequest> {
    await this.api.ensureSession(owner);
    return (await this.api.reject(approvalId, reason)).approval;
  }

  async rotateApiKey(owner: OwnerSession, contractId: string): Promise<string> {
    await this.api.ensureSession(owner);
    return (await this.api.rotateApiKey(contractId)).apiKey;
  }

  /**
   * The contract has no "list approvals" view, only `approval(to)`. We probe the recipients the
   * owner can plausibly have approved: allowlist entries, approval-request recipients and recent
   * payment recipients. A list endpoint or view would make this exact (see webapp report).
   */
  async listPreApprovals(owner: OwnerSession, contractId: string): Promise<PreApproval[]> {
    await this.api.ensureSession(owner);
    const [policy, { approvals }, { payments }] = await Promise.all([
      this.sdk.getPolicy(contractId),
      this.api.listApprovals({ contractId }),
      this.api.listPayments(contractId, 50),
    ]);
    const candidates = new Set<string>([
      ...policy.allowlist,
      ...approvals.map((a) => a.to),
      ...payments.map((p) => p.to),
    ]);
    const nowSec = Date.now() / 1000;
    const found = await Promise.all(
      [...candidates].map((to) =>
        this.sdk.getApproval(contractId, to).then(
          (a): PreApproval | null => (a ? { ...a, to } : null),
          () => null,
        ),
      ),
    );
    return found
      .filter((a): a is PreApproval => a !== null && a.expiresAt > nowSec)
      .sort((a, b) => a.expiresAt - b.expiresAt);
  }

  async preApprove(
    owner: OwnerSession,
    contractId: string,
    input: PreApprovalInput,
  ): Promise<string> {
    if (!isValidRecipient(input.to))
      throw new DataServiceError('Enter a valid Stellar address.', 'invalid');
    if (BigInt(input.amount) <= 0n)
      throw new DataServiceError('The amount must be above zero.', 'invalid');
    if (input.expiresAt * 1000 <= Date.now()) {
      throw new DataServiceError('The approval must expire in the future.', 'invalid');
    }
    return this.chain.approvePayment(owner, contractId, input.to, input.amount, input.expiresAt);
  }

  async revokePreApproval(owner: OwnerSession, contractId: string, to: string): Promise<void> {
    await this.chain.revokeApproval(owner, contractId, to);
  }
}
