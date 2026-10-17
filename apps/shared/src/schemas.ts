/**
 * Zod schemas for every cross-workspace type in docs/architecture/interfaces.md section 2.
 * TypeScript types are inferred from these schemas so the two can never drift.
 */

import { z } from 'zod';
import { isBaseUnitString } from './amount.js';
import { MAX_ALLOWLIST_LENGTH, NETWORKS } from './constants.js';
import { HALORA_ERROR_CODES } from './errors.js';
import { isAccountId, isContractId, isStellarAddress } from './strkey.js';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Non-negative integer base units as a decimal string, within i128 range. */
export const AmountSchema = z
  .string()
  .refine(isBaseUnitString, { message: 'must be a non-negative integer string of base units' });

/** Strictly positive amount (payments). */
export const PositiveAmountSchema = AmountSchema.refine((v) => BigInt(v) > 0n, {
  message: 'must be greater than zero',
});

export const AccountIdSchema = z
  .string()
  .refine(isAccountId, { message: 'must be a valid Stellar account ID (G...)' });

export const ContractIdSchema = z
  .string()
  .refine(isContractId, { message: 'must be a valid Stellar contract ID (C...)' });

/** Soroban `Address`: either an account (G...) or a contract (C...). */
export const AddressSchema = z
  .string()
  .refine(isStellarAddress, { message: 'must be a valid Stellar address (G... or C...)' });

export const NetworkSchema = z.enum(NETWORKS);

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const TxHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'must be a 64-char lowercase hex hash');

/** Base64-encoded XDR blob. */
export const XdrSchema = z.base64().min(1);

/** Unix seconds, 0 = never. Kept as a JS number per interfaces.md (safe up to 2^53). */
export const UnixSecondsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export const PolicySchema = z.object({
  token: ContractIdSchema,
  perTxLimit: AmountSchema,
  dailyLimit: AmountSchema,
  approvalThreshold: AmountSchema,
  allowlistEnabled: z.boolean(),
  allowlist: z.array(AddressSchema).max(MAX_ALLOWLIST_LENGTH),
  expiresAt: UnixSecondsSchema,
  paused: z.boolean(),
});
export type Policy = z.infer<typeof PolicySchema>;

export const AgentAccountSchema = z.object({
  contractId: ContractIdSchema,
  ownerPublicKey: AccountIdSchema,
  agentPublicKey: AccountIdSchema,
  label: z.string().min(1).max(100),
  network: NetworkSchema,
  createdAt: IsoDateTimeSchema,
});
export type AgentAccount = z.infer<typeof AgentAccountSchema>;

export const PaymentSourceSchema = z.enum(['x402', 'direct']);
export type PaymentSource = z.infer<typeof PaymentSourceSchema>;

export const PaymentRecordSchema = z.object({
  id: z.string().min(1),
  contractId: ContractIdSchema,
  token: ContractIdSchema,
  to: AddressSchema,
  amount: AmountSchema,
  txHash: TxHashSchema,
  ledger: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
  source: PaymentSourceSchema,
  resource: z.url().optional(),
});
export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'submitted',
] as const;
export const ApprovalStatusSchema = z.enum(APPROVAL_STATUSES);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().min(1),
  contractId: ContractIdSchema,
  token: ContractIdSchema,
  to: AddressSchema,
  amount: PositiveAmountSchema,
  reason: z.string().max(500),
  /** Hash of the owner's `approve_payment` transaction once approved. */
  approvalTxHash: TxHashSchema.optional(),
  status: ApprovalStatusSchema,
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const HaloraErrorCodeSchema = z.enum(HALORA_ERROR_CODES);

/** On-chain one-time pre-approval returned by the contract view `approval(to)`. */
export const OnChainApprovalSchema = z.object({
  amount: PositiveAmountSchema,
  expiresAt: UnixSecondsSchema,
});
export type OnChainApproval = z.infer<typeof OnChainApprovalSchema>;

// ---------------------------------------------------------------------------
// SDK results (interfaces.md section 4 references these by name)
// ---------------------------------------------------------------------------

export const PaymentResultSchema = z.object({
  status: z.literal('paid'),
  contractId: ContractIdSchema,
  token: ContractIdSchema,
  to: AddressSchema,
  amount: PositiveAmountSchema,
  txHash: TxHashSchema,
  ledger: z.number().int().nonnegative(),
});
export type PaymentResult = z.infer<typeof PaymentResultSchema>;

export const ApprovalPendingSchema = z.object({
  status: z.literal('approval_pending'),
  approvalId: z.string().min(1),
  contractId: ContractIdSchema,
  to: AddressSchema,
  amount: PositiveAmountSchema,
  expiresAt: IsoDateTimeSchema,
});
export type ApprovalPending = z.infer<typeof ApprovalPendingSchema>;

// ---------------------------------------------------------------------------
// API request bodies (interfaces.md section 3)
// ---------------------------------------------------------------------------

export const RegisterAccountBodySchema = z.object({
  contractId: ContractIdSchema,
  label: z.string().min(1).max(100),
  agentPublicKey: AccountIdSchema,
  network: NetworkSchema,
});
export type RegisterAccountBody = z.infer<typeof RegisterAccountBodySchema>;

/** Body of `POST /v1/approvals` (sent by the SDK with the agent API key). */
export const CreateApprovalBodySchema = z.object({
  contractId: ContractIdSchema,
  token: ContractIdSchema,
  to: AddressSchema,
  amount: PositiveAmountSchema,
  reason: z.string().max(500),
});
export type CreateApprovalBody = z.infer<typeof CreateApprovalBodySchema>;

/** Body of `POST /v1/approvals/:id/approve`: the owner's on-chain `approve_payment` tx. */
export const ApproveApprovalBodySchema = z.object({
  approvalTxHash: TxHashSchema,
});
export type ApproveApprovalBody = z.infer<typeof ApproveApprovalBodySchema>;

export const RejectApprovalBodySchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RejectApprovalBody = z.infer<typeof RejectApprovalBodySchema>;

export const ListApprovalsQuerySchema = z.object({
  contractId: ContractIdSchema.optional(),
  status: ApprovalStatusSchema.optional(),
});
export type ListApprovalsQuery = z.infer<typeof ListApprovalsQuerySchema>;
