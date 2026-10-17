import type { ApprovalRecord, ApprovalStatus, Principal } from '../domain';
import type { Repositories } from '../repositories/types';
import type { ChainReader, OnChainApproval } from '../stellar/chain';
import { randomId } from '../utils/crypto';
import { ApiError, approvalNotOnChain, forbidden, notFound } from '../utils/errors';
import type { Logger } from '../utils/logger';
import type { AccountService } from './account.service';

export type CreateApprovalInput = {
  contractId: string;
  token: string;
  to: string;
  amount: string;
  reason: string;
  expiresInSeconds?: number;
};

export type ApprovalServiceOptions = {
  defaultTtlSeconds: number;
  now: () => Date;
};

/**
 * Approval queue (interfaces.md section 3, on-chain pre-approval model).
 *
 * The API holds no keys and never signs or submits anything. The owner approves by signing and
 * submitting `approve_payment(to, amount, expires_at)` on the account contract (from the
 * webapp), then posts the transaction hash here. The API only marks a request approved after it
 * reads the contract's `approval(to)` view and finds an unexpired approval whose amount covers
 * the request. The agent, polling GET /v1/approvals/:id, then retries the payment, which the
 * contract checks again and consumes. The payment indexer moves the request to `submitted` once
 * it sees the matching token transfer.
 */
export class ApprovalService {
  constructor(
    private readonly repos: Repositories,
    private readonly accounts: AccountService,
    private readonly chain: ChainReader,
    private readonly logger: Logger,
    private readonly opts: ApprovalServiceOptions,
  ) {}

  /**
   * Creates a request. Idempotent: if an identical pending request (same recipient, amount and
   * token) exists it is returned with `created: false`, so agent retries do not flood the owner.
   */
  async create(
    principal: Principal,
    input: CreateApprovalInput,
  ): Promise<{ approval: ApprovalRecord; created: boolean }> {
    if (principal.kind !== 'agent') throw forbidden('Only an agent can create approval requests');
    if (input.contractId !== principal.contractId) {
      throw forbidden('An agent key can only create approvals for its own account');
    }
    const now = this.opts.now();
    const pending = await this.repos.approvals.list({
      contractIds: [principal.contractId],
      status: 'pending',
      limit: 200,
    });
    const existing = pending.find(
      (p) =>
        p.to === input.to &&
        p.amount === input.amount &&
        p.token === input.token &&
        new Date(p.expiresAt) > now,
    );
    if (existing) return { approval: existing, created: false };

    const ttl = input.expiresInSeconds ?? this.opts.defaultTtlSeconds;
    const record: ApprovalRecord = {
      id: randomId(),
      contractId: principal.contractId,
      token: input.token,
      to: input.to,
      amount: input.amount,
      reason: input.reason,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
    };
    await this.repos.approvals.create(record);
    this.logger.info('approval created', {
      approvalId: record.id,
      contractId: record.contractId,
      amount: record.amount,
    });
    return { approval: record, created: true };
  }

  async list(
    principal: Principal,
    filter: { contractId?: string; status?: ApprovalStatus; limit: number },
  ): Promise<ApprovalRecord[]> {
    let contractIds: string[];
    if (principal.kind === 'agent') {
      if (filter.contractId && filter.contractId !== principal.contractId) return [];
      contractIds = [principal.contractId];
    } else if (filter.contractId) {
      await this.accounts.requireReadable(principal, filter.contractId);
      contractIds = [filter.contractId];
    } else {
      contractIds = (await this.repos.accounts.listByOwner(principal.publicKey)).map(
        (a) => a.contractId,
      );
    }
    const rows = await this.repos.approvals.list({
      contractIds,
      status: filter.status,
      limit: filter.limit,
    });
    return rows.map((r) => this.withLazyExpiry(r));
  }

  async get(principal: Principal, id: string): Promise<ApprovalRecord> {
    return this.withLazyExpiry(await this.load(principal, id));
  }

  async approve(principal: Principal, id: string, approvalTxHash: string) {
    if (principal.kind !== 'owner') throw forbidden('Only the account owner can approve');
    const record = await this.requirePending(principal, id);

    let onChain: OnChainApproval | null;
    try {
      onChain = await this.chain.getApproval(record.contractId, record.to);
    } catch (err) {
      this.logger.warn('approval lookup failed', { approvalId: id, err });
      throw new ApiError(502, 'chain_unavailable', 'Could not read approval() from the contract');
    }
    const nowSeconds = Math.floor(this.opts.now().getTime() / 1000);
    if (!onChain) {
      throw approvalNotOnChain(
        'No on-chain approval found for this recipient. If the approve_payment transaction was just submitted, retry in a few seconds.',
      );
    }
    if (onChain.amount < BigInt(record.amount)) {
      throw approvalNotOnChain('The on-chain approval amount is lower than the requested amount');
    }
    if (onChain.expiresAt <= nowSeconds) {
      throw approvalNotOnChain('The on-chain approval has already expired');
    }

    const updated = await this.repos.approvals.transition(id, 'pending', {
      status: 'approved',
      approvalTxHash,
    });
    if (!updated) throw this.notPending();
    this.logger.info('approval approved', { approvalId: id, contractId: record.contractId });
    return updated;
  }

  async reject(principal: Principal, id: string, reason?: string) {
    if (principal.kind !== 'owner') throw forbidden('Only the account owner can reject');
    await this.requirePending(principal, id);
    const updated = await this.repos.approvals.transition(id, 'pending', {
      status: 'rejected',
      ...(reason ? { rejectionReason: reason } : {}),
    });
    if (!updated) throw this.notPending();
    this.logger.info('approval rejected', { approvalId: id, contractId: updated.contractId });
    return updated;
  }

  private async load(principal: Principal, id: string): Promise<ApprovalRecord> {
    const record = await this.repos.approvals.findById(id);
    if (!record) throw notFound('Approval not found');
    // Hides the existence of approvals on accounts the caller cannot read.
    await this.accounts.requireReadable(principal, record.contractId).catch(() => {
      throw notFound('Approval not found');
    });
    return record;
  }

  private async requirePending(principal: Principal, id: string): Promise<ApprovalRecord> {
    const record = await this.load(principal, id);
    if (record.status === 'pending' && new Date(record.expiresAt) <= this.opts.now()) {
      await this.repos.approvals.transition(id, 'pending', { status: 'expired' });
      throw this.notPending('Approval request has expired');
    }
    if (record.status !== 'pending') throw this.notPending();
    return record;
  }

  private withLazyExpiry(r: ApprovalRecord): ApprovalRecord {
    if (r.status === 'pending' && new Date(r.expiresAt) <= this.opts.now()) {
      return { ...r, status: 'expired' };
    }
    return r;
  }

  private notPending(message = 'Approval request is no longer pending') {
    return new ApiError(409, 'approval_not_pending', message);
  }
}
