/**
 * Domain types used by the API. Wire types come from @halora/shared (interfaces.md section 2);
 * the extra types here are server-side only.
 */
import type { AgentAccount, ApprovalRequest, ApprovalStatus, PaymentRecord } from '@halora/shared';

export type { AgentAccount, ApprovalRequest, ApprovalStatus, PaymentRecord };

/** ApprovalRequest as stored and returned by the API, plus the owner's optional rejection reason. */
export type ApprovalRecord = ApprovalRequest & { rejectionReason?: string };

/** An AgentAccount plus server-side fields. Only the API key hash is stored. */
export type StoredAccount = AgentAccount & {
  /** Policy token read at registration; the indexer reads its `transfer` events. */
  token: string;
  apiKeyId: string;
  apiKeyHash: string;
};

export type OwnerChallenge = {
  nonce: string;
  publicKey: string;
  message: string;
  expiresAt: Date;
};

export type Session = {
  tokenHash: string;
  publicKey: string;
  expiresAt: Date;
};

/** Who is calling. Owners are identified by their G-address, agents by their account. */
export type Principal =
  | { kind: 'owner'; publicKey: string }
  | { kind: 'agent'; contractId: string; account: StoredAccount };
