import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const networkEnum = pgEnum('network', ['testnet', 'mainnet']);
export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
  'submitted',
]);
export const paymentSourceEnum = pgEnum('payment_source', ['x402', 'direct']);

/** Single-use owner login challenges. */
export const ownerChallenges = pgTable('owner_challenges', {
  nonce: text('nonce').primaryKey(),
  publicKey: text('public_key').notNull(),
  message: text('message').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** Owner sessions. Only the SHA-256 of the opaque session token is stored. */
export const ownerSessions = pgTable(
  'owner_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    publicKey: text('public_key').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('owner_sessions_expires_idx').on(t.expiresAt)],
);

export const agentAccounts = pgTable(
  'agent_accounts',
  {
    contractId: text('contract_id').primaryKey(),
    ownerPublicKey: text('owner_public_key').notNull(),
    agentPublicKey: text('agent_public_key').notNull(),
    label: text('label').notNull(),
    network: networkEnum('network').notNull(),
    /** Policy token at registration time; its `transfer` events feed the payment log. */
    token: text('token').notNull(),
    /** Public identifier embedded in the API key, used for lookup. */
    apiKeyId: text('api_key_id').notNull(),
    /** SHA-256 of the full API key. The key itself is shown once and never stored. */
    apiKeyHash: text('api_key_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('agent_accounts_owner_idx').on(t.ownerPublicKey),
    uniqueIndex('agent_accounts_api_key_id_idx').on(t.apiKeyId),
  ],
);

export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: text('id').primaryKey(),
    contractId: text('contract_id')
      .notNull()
      .references(() => agentAccounts.contractId),
    token: text('token').notNull(),
    to: text('to_address').notNull(),
    amount: text('amount').notNull(),
    reason: text('reason').notNull(),
    /** Hash of the owner's on-chain approve_payment transaction, once approved. */
    approvalTxHash: text('approval_tx_hash'),
    status: approvalStatusEnum('status').notNull(),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('approval_requests_contract_status_idx').on(t.contractId, t.status),
    index('approval_requests_status_expires_idx').on(t.status, t.expiresAt),
  ],
);

export const paymentRecords = pgTable(
  'payment_records',
  {
    /** Stellar RPC event id of the token transfer, globally unique, so indexing is idempotent. */
    id: text('id').primaryKey(),
    contractId: text('contract_id').notNull(),
    token: text('token').notNull(),
    to: text('to_address').notNull(),
    amount: text('amount').notNull(),
    txHash: text('tx_hash').notNull(),
    ledger: integer('ledger').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    source: paymentSourceEnum('source').notNull(),
    resource: text('resource'),
  },
  (t) => [index('payment_records_contract_ledger_idx').on(t.contractId, t.ledger)],
);

export const indexerCursors = pgTable('indexer_cursors', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
