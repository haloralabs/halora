/**
 * Domain types for the owner dashboard. The cross-workspace types and schemas come from
 * `@halora/shared` (docs/architecture/interfaces.md section 2); only view models specific to the
 * dashboard are defined here.
 */
import {
  AddressSchema,
  OnChainApprovalSchema,
  type Policy,
  type AgentAccount,
} from '@halora/shared';
import type { z } from 'zod';

export {
  AgentAccountSchema,
  ApprovalRequestSchema,
  ApprovalStatusSchema,
  NetworkSchema,
  PaymentRecordSchema,
  PolicySchema,
} from '@halora/shared';
export type {
  AgentAccount,
  ApprovalRequest,
  ApprovalStatus,
  HaloraErrorCode,
  Network,
  PaymentRecord,
  Policy,
} from '@halora/shared';

/**
 * An active on-chain pre-approval (contract view `approval(to)`) together with its recipient:
 * the next agent transfer to `to` of at most `amount`, before `expiresAt` (unix seconds), passes
 * the approval threshold rule and consumes it. Per payment and daily limits still apply.
 */
export const PreApprovalSchema = OnChainApprovalSchema.extend({ to: AddressSchema });
export type PreApproval = z.infer<typeof PreApprovalSchema>;

/** What the dashboard shows for one agent wallet: on-chain state joined with API metadata. */
export type AgentOverview = {
  account: AgentAccount;
  policy: Policy;
  /** Token balance of the account contract, base units. `null` when it could not be read. */
  balance: string | null;
  /** Read from the contract view `spent_today`, base units. */
  spentToday: string;
  pendingApprovals: number;
};
