import type {
  AgentOverview,
  ApprovalRequest,
  PaymentRecord,
  Policy,
  PreApproval,
} from '@/lib/domain';
import { PolicySchema } from '@/lib/domain';
import { isValidRecipient, validatePolicy } from '@/lib/policy';
import {
  DataServiceError,
  type ApprovalQuery,
  type CreateAgentInput,
  type CreateAgentResult,
  type HaloraDataService,
  type OwnerSession,
  type PaymentQuery,
  type PreApprovalInput,
  DEFAULT_APPROVAL_TTL_SECONDS,
} from '../types';
import { createSeed, makeKeyFactory, type SeedState } from './seed';

const DAY_MS = 86_400_000;

export type MockOptions = {
  /** Simulated network latency in ms. Tests pass 0. */
  latencyMs?: number;
  now?: () => number;
  seed?: SeedState;
};

/**
 * In-memory implementation used by default (NEXT_PUBLIC_HALORA_DATA_MODE=mock). It applies the
 * same rules the account contract and API apply (owner-only writes, policy validation, pending-only
 * approvals, expiry) so the demo behaves like the real system rather than accepting anything.
 */
export class MockDataService implements HaloraDataService {
  readonly mode = 'mock' as const;
  private state: SeedState;
  private readonly latencyMs: number;
  private readonly now: () => number;
  private readonly keys = makeKeyFactory(Date.now() & 0xffff);

  constructor(opts: MockOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.state = opts.seed ?? createSeed(this.now());
    this.latencyMs = opts.latencyMs ?? 280;
  }

  /** The seeded owner key the mock wallet connects as. */
  get ownerPublicKey(): string {
    return this.state.ownerPublicKey;
  }

  get usdcContractId(): string {
    return this.state.usdc;
  }

  private async delay<T>(value: T): Promise<T> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    return structuredClone(value);
  }

  private assertOwner(owner: OwnerSession, contractId: string) {
    const account = this.state.accounts.find((a) => a.contractId === contractId);
    if (!account) throw new DataServiceError('Agent wallet not found.', 'not_found');
    if (account.ownerPublicKey !== owner.publicKey) {
      throw new DataServiceError(
        'The connected wallet is not the owner of this account.',
        'unauthorized',
      );
    }
    return account;
  }

  /** In mock mode any connected key becomes the owner of the seeded accounts on first use. */
  private adopt(owner: OwnerSession) {
    if (this.state.ownerPublicKey === owner.publicKey) return;
    const previous = this.state.ownerPublicKey;
    this.state.ownerPublicKey = owner.publicKey;
    for (const a of this.state.accounts)
      if (a.ownerPublicKey === previous) a.ownerPublicKey = owner.publicKey;
  }

  private spentToday(contractId: string): string {
    const today = Math.floor(this.now() / DAY_MS);
    let total = 0n;
    for (const p of this.state.payments) {
      if (p.contractId !== contractId) continue;
      if (Math.floor(new Date(p.createdAt).getTime() / DAY_MS) === today) total += BigInt(p.amount);
    }
    return total.toString();
  }

  private refreshExpiry() {
    const now = this.now();
    for (const a of this.state.approvals) {
      if (a.status === 'pending' && new Date(a.expiresAt).getTime() <= now) a.status = 'expired';
    }
  }

  private overview(contractId: string): AgentOverview {
    const account = this.state.accounts.find((a) => a.contractId === contractId);
    const policy = this.state.policies.get(contractId);
    if (!account || !policy) throw new DataServiceError('Agent wallet not found.', 'not_found');
    return {
      account,
      policy,
      balance: this.state.balances.get(contractId) ?? null,
      spentToday: this.spentToday(contractId),
      pendingApprovals: this.state.approvals.filter(
        (a) => a.contractId === contractId && a.status === 'pending',
      ).length,
    };
  }

  async listAgents(owner: OwnerSession): Promise<AgentOverview[]> {
    this.adopt(owner);
    this.refreshExpiry();
    const list = this.state.accounts
      .filter((a) => a.ownerPublicKey === owner.publicKey)
      .map((a) => this.overview(a.contractId));
    return this.delay(list);
  }

  async getAgent(owner: OwnerSession, contractId: string): Promise<AgentOverview | null> {
    this.adopt(owner);
    this.refreshExpiry();
    const account = this.state.accounts.find((a) => a.contractId === contractId);
    if (!account || account.ownerPublicKey !== owner.publicKey) return this.delay(null);
    return this.delay(this.overview(contractId));
  }

  async createAgent(owner: OwnerSession, input: CreateAgentInput): Promise<CreateAgentResult> {
    this.adopt(owner);
    const policy = PolicySchema.parse({
      ...input.policy,
      token: input.policy.token || this.state.usdc,
    });
    const problems = validatePolicy(policy, this.now());
    if (problems.length > 0) throw new DataServiceError(problems[0]!.message, 'invalid');
    if (input.agentPublicKey === owner.publicKey) {
      throw new DataServiceError('The agent key must be different from the owner key.', 'invalid');
    }
    // Simulates the deploy transaction the owner signs in live mode.
    await owner.wallet.signTransaction(`mock-deploy:${input.label}`, owner.publicKey);
    const account = {
      contractId: this.keys.contract(),
      ownerPublicKey: owner.publicKey,
      agentPublicKey: input.agentPublicKey,
      label: input.label.trim(),
      network: owner.network,
      createdAt: new Date(this.now()).toISOString(),
    };
    const apiKey = `hal_test_${this.keys.hex(16)}`;
    this.state.accounts.unshift(account);
    this.state.policies.set(account.contractId, policy);
    this.state.balances.set(account.contractId, '0');
    this.state.apiKeys.set(account.contractId, apiKey);
    return this.delay({ account, apiKey });
  }

  async updatePolicy(owner: OwnerSession, contractId: string, next: Policy): Promise<Policy> {
    this.assertOwner(owner, contractId);
    const policy = PolicySchema.parse(next);
    const problems = validatePolicy(policy, this.now());
    if (problems.length > 0) throw new DataServiceError(problems[0]!.message, 'invalid');
    const current = this.state.policies.get(contractId);
    if (current && current.token !== policy.token) {
      throw new DataServiceError(
        'The policy token cannot be changed from the dashboard.',
        'invalid',
      );
    }
    await owner.wallet.signTransaction(`mock-set-policy:${contractId}`, owner.publicKey);
    this.state.policies.set(contractId, policy);
    return this.delay(policy);
  }

  async setPaused(owner: OwnerSession, contractId: string, paused: boolean): Promise<Policy> {
    this.assertOwner(owner, contractId);
    const current = this.state.policies.get(contractId);
    if (!current) throw new DataServiceError('Agent wallet not found.', 'not_found');
    await owner.wallet.signTransaction(
      `mock-${paused ? 'pause' : 'unpause'}:${contractId}`,
      owner.publicKey,
    );
    const policy = { ...current, paused };
    this.state.policies.set(contractId, policy);
    return this.delay(policy);
  }

  async listPayments(owner: OwnerSession, query: PaymentQuery = {}): Promise<PaymentRecord[]> {
    this.adopt(owner);
    const owned = new Set(
      this.state.accounts
        .filter((a) => a.ownerPublicKey === owner.publicKey)
        .map((a) => a.contractId),
    );
    const list = this.state.payments
      .filter((p) => owned.has(p.contractId))
      .filter((p) => !query.contractId || p.contractId === query.contractId)
      .slice(0, query.limit ?? 200);
    return this.delay(list);
  }

  async listApprovals(owner: OwnerSession, query: ApprovalQuery = {}): Promise<ApprovalRequest[]> {
    this.adopt(owner);
    this.refreshExpiry();
    const owned = new Set(
      this.state.accounts
        .filter((a) => a.ownerPublicKey === owner.publicKey)
        .map((a) => a.contractId),
    );
    const list = this.state.approvals
      .filter((a) => owned.has(a.contractId))
      .filter((a) => !query.contractId || a.contractId === query.contractId)
      .filter((a) => !query.status || a.status === query.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return this.delay(list);
  }

  private pendingApproval(owner: OwnerSession, approvalId: string): ApprovalRequest {
    this.refreshExpiry();
    const approval = this.state.approvals.find((a) => a.id === approvalId);
    if (!approval) throw new DataServiceError('Approval request not found.', 'not_found');
    this.assertOwner(owner, approval.contractId);
    if (approval.status !== 'pending') {
      throw new DataServiceError(`This request is already ${approval.status}.`, 'conflict');
    }
    return approval;
  }

  async approve(
    owner: OwnerSession,
    approvalId: string,
    opts: { expiresAt?: number } = {},
  ): Promise<ApprovalRequest> {
    const approval = this.pendingApproval(owner, approvalId);
    const expiresAt =
      opts.expiresAt ?? Math.floor(this.now() / 1000) + DEFAULT_APPROVAL_TTL_SECONDS;
    const txHash = await this.writePreApproval(owner, approval.contractId, {
      to: approval.to,
      amount: approval.amount,
      expiresAt,
    });
    approval.approvalTxHash = txHash;
    approval.status = 'approved';
    return this.delay(approval);
  }

  private async writePreApproval(
    owner: OwnerSession,
    contractId: string,
    input: PreApprovalInput,
  ): Promise<string> {
    this.assertOwner(owner, contractId);
    if (!isValidRecipient(input.to))
      throw new DataServiceError('Enter a valid Stellar address.', 'invalid');
    if (!/^\d+$/.test(input.amount) || BigInt(input.amount) <= 0n) {
      throw new DataServiceError('The amount must be above zero.', 'invalid');
    }
    if (input.expiresAt * 1000 <= this.now()) {
      throw new DataServiceError('The approval must expire in the future.', 'invalid');
    }
    // Simulates the approve_payment transaction the owner signs and submits in live mode.
    await owner.wallet.signTransaction(
      `mock-approve-payment:${contractId}:${input.to}`,
      owner.publicKey,
    );
    const byTo = this.state.preApprovals.get(contractId) ?? new Map<string, PreApproval>();
    byTo.set(input.to, { ...input }); // replaces any existing approval for the recipient, like the contract
    this.state.preApprovals.set(contractId, byTo);
    return this.keys.hex(32);
  }

  async listPreApprovals(owner: OwnerSession, contractId: string): Promise<PreApproval[]> {
    this.assertOwner(owner, contractId);
    const nowSec = this.now() / 1000;
    const list = [...(this.state.preApprovals.get(contractId)?.values() ?? [])]
      .filter((a) => a.expiresAt > nowSec)
      .sort((a, b) => a.expiresAt - b.expiresAt);
    return this.delay(list);
  }

  async preApprove(
    owner: OwnerSession,
    contractId: string,
    input: PreApprovalInput,
  ): Promise<string> {
    const hash = await this.writePreApproval(owner, contractId, input);
    return this.delay(hash);
  }

  async revokePreApproval(owner: OwnerSession, contractId: string, to: string): Promise<void> {
    this.assertOwner(owner, contractId);
    await owner.wallet.signTransaction(`mock-revoke-approval:${contractId}:${to}`, owner.publicKey);
    this.state.preApprovals.get(contractId)?.delete(to);
    await this.delay(null);
  }

  async reject(owner: OwnerSession, approvalId: string): Promise<ApprovalRequest> {
    const approval = this.pendingApproval(owner, approvalId);
    approval.status = 'rejected';
    return this.delay(approval);
  }

  async rotateApiKey(owner: OwnerSession, contractId: string): Promise<string> {
    this.assertOwner(owner, contractId);
    const apiKey = `hal_test_${this.keys.hex(16)}`;
    this.state.apiKeys.set(contractId, apiKey);
    return this.delay(apiKey);
  }
}
