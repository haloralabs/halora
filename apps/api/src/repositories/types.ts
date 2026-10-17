import type {
  ApprovalRecord,
  ApprovalStatus,
  OwnerChallenge,
  PaymentRecord,
  Session,
  StoredAccount,
} from '../domain';

/**
 * Persistence ports. Services depend on these interfaces only. Production uses the Drizzle
 * implementations (PostgreSQL); tests use the in-memory implementations.
 */

export interface ChallengeRepository {
  create(challenge: OwnerChallenge): Promise<void>;
  /** Atomically removes and returns the challenge, so it can be used at most once. */
  consume(nonce: string): Promise<OwnerChallenge | null>;
  deleteExpired(now: Date): Promise<number>;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  deleteExpired(now: Date): Promise<number>;
}

export interface AccountRepository {
  /** Throws `DuplicateError` if the contract is already registered. */
  create(account: StoredAccount): Promise<void>;
  findByContractId(contractId: string): Promise<StoredAccount | null>;
  findByApiKeyId(apiKeyId: string): Promise<StoredAccount | null>;
  listByOwner(ownerPublicKey: string): Promise<StoredAccount[]>;
  listAll(): Promise<StoredAccount[]>;
}

export type ApprovalFilter = {
  contractIds: string[];
  status?: ApprovalStatus;
  limit: number;
};

export interface ApprovalRepository {
  create(approval: ApprovalRecord): Promise<void>;
  findById(id: string): Promise<ApprovalRecord | null>;
  list(filter: ApprovalFilter): Promise<ApprovalRecord[]>;
  /**
   * Compare-and-set: applies `patch` only if the current status equals `from`.
   * Returns the updated row, or null when the status had already changed (lost race).
   */
  transition(
    id: string,
    from: ApprovalStatus,
    patch: Partial<Pick<ApprovalRecord, 'status' | 'approvalTxHash' | 'rejectionReason'>>,
  ): Promise<ApprovalRecord | null>;
  /** Marks every pending approval with `expiresAt <= now` as expired. Returns the count. */
  expirePending(now: Date): Promise<number>;
  /** Approved requests whose recipient matches an indexed payment from the account. */
  findApprovedForRecipient(contractId: string, to: string): Promise<ApprovalRecord[]>;
}

export interface PaymentRepository {
  /** Inserts records, ignoring ones whose id already exists. Returns the number inserted. */
  insertMany(records: PaymentRecord[]): Promise<number>;
  listByContract(contractId: string, limit: number): Promise<PaymentRecord[]>;
}

export interface CursorRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export type Repositories = {
  challenges: ChallengeRepository;
  sessions: SessionRepository;
  accounts: AccountRepository;
  approvals: ApprovalRepository;
  payments: PaymentRepository;
  cursors: CursorRepository;
};

export class DuplicateError extends Error {
  constructor(message = 'Duplicate') {
    super(message);
    this.name = 'DuplicateError';
  }
}
