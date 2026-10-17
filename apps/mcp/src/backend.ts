/**
 * The wallet operations the MCP tools need. The production implementation (sdk-backend.ts)
 * wraps @halora/sdk; tests inject a mock. Nothing here ever returns key material.
 */

export type WalletPolicy = {
  token: string;
  perTxLimit: string;
  dailyLimit: string;
  approvalThreshold: string;
  allowlistEnabled: boolean;
  allowlist: string[];
  expiresAt: number;
  paused: boolean;
};

export type WalletStatus = {
  contractId: string;
  network: 'testnet' | 'mainnet';
  /** Token balance of the account, base units. */
  balance: string;
  policy: WalletPolicy;
  spentToday: string;
};

export type PaymentRecordView = {
  id: string;
  to: string;
  amount: string;
  token: string;
  txHash: string;
  ledger: number;
  createdAt: string;
  source: 'x402' | 'direct';
  resource?: string;
};

export type PayOutcome =
  | { status: 'paid'; txHash: string; amount: string; to: string }
  | {
      status: 'approval_pending';
      approvalId: string;
      amount: string;
      to: string;
      expiresAt?: string;
    };

export type FetchOutcome = {
  status: number;
  contentType: string | null;
  body: string;
  /** Set when the request needed an x402 payment that was made within policy. */
  payment?: { amount: string; to: string; asset: string; network: string };
};

export type ApprovalInfo = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'submitted';
  to: string;
  amount: string;
  reason: string;
  expiresAt: string;
  rejectionReason?: string;
};

export interface WalletBackend {
  status(): Promise<WalletStatus>;
  pay(input: { to: string; amount: bigint; reason: string }): Promise<PayOutcome>;
  fetchPaid(input: { url: string; method: string; body?: string }): Promise<FetchOutcome>;
  approvalStatus(id: string): Promise<ApprovalInfo>;
  recentPayments(limit: number): Promise<PaymentRecordView[]>;
}

/**
 * Thrown (or mapped from SDK errors) when the policy refuses an action. `code` is one of the
 * contract error names from interfaces.md (for example PerTxLimitExceeded).
 */
export class PolicyRefusal extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PolicyRefusal';
  }
}
