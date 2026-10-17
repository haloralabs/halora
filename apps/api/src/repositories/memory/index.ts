import type {
  ApprovalRecord,
  OwnerChallenge,
  PaymentRecord,
  Session,
  StoredAccount,
} from '../../domain';
import {
  DuplicateError,
  type AccountRepository,
  type ApprovalFilter,
  type ApprovalRepository,
  type ChallengeRepository,
  type CursorRepository,
  type PaymentRepository,
  type Repositories,
  type SessionRepository,
} from '../types';

/** In-memory repositories for tests and local experiments. Not for production use. */

class MemoryChallenges implements ChallengeRepository {
  private rows = new Map<string, OwnerChallenge>();
  async create(c: OwnerChallenge) {
    this.rows.set(c.nonce, { ...c });
  }
  async consume(nonce: string) {
    const row = this.rows.get(nonce) ?? null;
    this.rows.delete(nonce);
    return row;
  }
  async deleteExpired(now: Date) {
    let n = 0;
    for (const [k, v] of this.rows) {
      if (v.expiresAt <= now) {
        this.rows.delete(k);
        n++;
      }
    }
    return n;
  }
}

class MemorySessions implements SessionRepository {
  private rows = new Map<string, Session>();
  async create(s: Session) {
    this.rows.set(s.tokenHash, { ...s });
  }
  async findByTokenHash(h: string) {
    return this.rows.get(h) ?? null;
  }
  async deleteExpired(now: Date) {
    let n = 0;
    for (const [k, v] of this.rows) {
      if (v.expiresAt <= now) {
        this.rows.delete(k);
        n++;
      }
    }
    return n;
  }
}

class MemoryAccounts implements AccountRepository {
  private rows = new Map<string, StoredAccount>();
  async create(a: StoredAccount) {
    if (this.rows.has(a.contractId)) throw new DuplicateError('Account already registered');
    this.rows.set(a.contractId, { ...a });
  }
  async findByContractId(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByApiKeyId(keyId: string) {
    for (const a of this.rows.values()) if (a.apiKeyId === keyId) return a;
    return null;
  }
  async listByOwner(owner: string) {
    return [...this.rows.values()]
      .filter((a) => a.ownerPublicKey === owner)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listAll() {
    return [...this.rows.values()];
  }
}

class MemoryApprovals implements ApprovalRepository {
  private rows = new Map<string, ApprovalRecord>();
  async create(a: ApprovalRecord) {
    if (this.rows.has(a.id)) throw new DuplicateError();
    this.rows.set(a.id, { ...a });
  }
  async findById(id: string) {
    const r = this.rows.get(id);
    return r ? { ...r } : null;
  }
  async list(f: ApprovalFilter) {
    return [...this.rows.values()]
      .filter((a) => f.contractIds.includes(a.contractId))
      .filter((a) => !f.status || a.status === f.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, f.limit)
      .map((a) => ({ ...a }));
  }
  async transition(
    id: string,
    from: ApprovalRecord['status'],
    patch: Partial<Pick<ApprovalRecord, 'status' | 'approvalTxHash' | 'rejectionReason'>>,
  ) {
    const r = this.rows.get(id);
    if (!r || r.status !== from) return null;
    const next = { ...r, ...patch };
    this.rows.set(id, next);
    return { ...next };
  }
  async expirePending(now: Date) {
    let n = 0;
    for (const r of this.rows.values()) {
      if (r.status === 'pending' && new Date(r.expiresAt) <= now) {
        r.status = 'expired';
        n++;
      }
    }
    return n;
  }
  async findApprovedForRecipient(contractId: string, to: string) {
    return [...this.rows.values()]
      .filter((r) => r.status === 'approved' && r.contractId === contractId && r.to === to)
      .map((r) => ({ ...r }));
  }
}

class MemoryPayments implements PaymentRepository {
  private rows = new Map<string, PaymentRecord>();
  async insertMany(records: PaymentRecord[]) {
    let n = 0;
    for (const r of records) {
      if (!this.rows.has(r.id)) {
        this.rows.set(r.id, { ...r });
        n++;
      }
    }
    return n;
  }
  async listByContract(contractId: string, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.contractId === contractId)
      .sort((a, b) => b.ledger - a.ledger || b.id.localeCompare(a.id))
      .slice(0, limit);
  }
}

class MemoryCursors implements CursorRepository {
  private rows = new Map<string, string>();
  async get(k: string) {
    return this.rows.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.rows.set(k, v);
  }
}

export function createMemoryRepositories(): Repositories {
  return {
    challenges: new MemoryChallenges(),
    sessions: new MemorySessions(),
    accounts: new MemoryAccounts(),
    approvals: new MemoryApprovals(),
    payments: new MemoryPayments(),
    cursors: new MemoryCursors(),
  };
}
