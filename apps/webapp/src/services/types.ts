import type {
  AgentAccount,
  AgentOverview,
  ApprovalRequest,
  ApprovalStatus,
  Network,
  PaymentRecord,
  Policy,
  PreApproval,
} from '@/lib/domain';

/**
 * The owner's wallet, as seen by the data layer. Implemented by Stellar Wallets Kit in live mode
 * and by a deterministic in-memory signer in mock mode. Secret keys never pass through here.
 */
export interface OwnerWallet {
  readonly kind: 'mock' | 'kit';
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  /**
   * Signs a base64 `HashIdPreimage` (Soroban authorization) and returns the raw 64-byte
   * ed25519 signature. This is what SEP-43 wallets return from `signAuthEntry`.
   */
  signAuthEntryPreimage(preimageXdr: string, publicKey: string): Promise<Uint8Array>;
  signTransaction(transactionXdr: string, publicKey: string): Promise<string>;
  signMessage(message: string, publicKey: string): Promise<string>;
}

/** The connected owner: public key plus the wallet that can sign for it. */
export type OwnerSession = {
  publicKey: string;
  wallet: OwnerWallet;
  network: Network;
};

export type CreateAgentInput = {
  label: string;
  agentPublicKey: string;
  policy: Policy;
};

export type CreateAgentResult = {
  account: AgentAccount;
  /** Shown to the owner exactly once. The API stores only a hash. */
  apiKey: string;
};

/** Input for an owner pre-approval (contract `approve_payment`). */
export type PreApprovalInput = {
  to: string;
  /** Base units; the agent may pay up to this much, once. */
  amount: string;
  /** Unix seconds; must be in the future. */
  expiresAt: number;
};

/** Default validity offered when approving a request: 15 minutes. */
export const DEFAULT_APPROVAL_TTL_SECONDS = 15 * 60;

export type PaymentQuery = { contractId?: string; limit?: number };
export type ApprovalQuery = { contractId?: string; status?: ApprovalStatus };

/**
 * Everything the dashboard reads or writes. Two implementations: `MockDataService` (seeded,
 * in memory) and `LiveDataService` (Halora API plus Soroban RPC). Pages only see this interface.
 */
export interface HaloraDataService {
  readonly mode: 'mock' | 'live';
  listAgents(owner: OwnerSession): Promise<AgentOverview[]>;
  getAgent(owner: OwnerSession, contractId: string): Promise<AgentOverview | null>;
  createAgent(owner: OwnerSession, input: CreateAgentInput): Promise<CreateAgentResult>;
  updatePolicy(owner: OwnerSession, contractId: string, policy: Policy): Promise<Policy>;
  setPaused(owner: OwnerSession, contractId: string, paused: boolean): Promise<Policy>;
  listPayments(owner: OwnerSession, query?: PaymentQuery): Promise<PaymentRecord[]>;
  listApprovals(owner: OwnerSession, query?: ApprovalQuery): Promise<ApprovalRequest[]>;
  /**
   * Approves an agent request: the owner signs and submits `approve_payment(to, amount, expiresAt)`
   * for the request's recipient and amount, then the API is told the transaction hash.
   */
  approve(
    owner: OwnerSession,
    approvalId: string,
    opts?: { expiresAt?: number },
  ): Promise<ApprovalRequest>;
  reject(owner: OwnerSession, approvalId: string, reason?: string): Promise<ApprovalRequest>;
  rotateApiKey(owner: OwnerSession, contractId: string): Promise<string>;
  /** Active, unexpired pre-approvals on the account. */
  listPreApprovals(owner: OwnerSession, contractId: string): Promise<PreApproval[]>;
  /** Proactively pre-approve one payment to a recipient. Returns the transaction hash. */
  preApprove(owner: OwnerSession, contractId: string, input: PreApprovalInput): Promise<string>;
  revokePreApproval(owner: OwnerSession, contractId: string, to: string): Promise<void>;
}

/** A failure the UI can show to the owner as is. */
export class DataServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'unauthorized'
      | 'invalid'
      | 'not_supported'
      | 'network'
      | 'signature'
      | 'conflict' = 'invalid',
  ) {
    super(message);
    this.name = 'DataServiceError';
  }
}
