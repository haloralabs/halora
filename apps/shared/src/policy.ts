/**
 * Local mirror of the agent-payment checks performed by `halora-account` in `__check_auth`.
 *
 * Used for pre-flight (SDK), display (webapp) and approval routing (API, MCP). The contract is
 * the source of truth: a passing local evaluation does not guarantee the on-chain check passes
 * (for example if another payment lands first). Order matches interfaces.md section 1.
 */

import { MAX_ALLOWLIST_LENGTH, SECONDS_PER_DAY } from './constants.js';
import type { HaloraErrorCode } from './errors.js';
import type { OnChainApproval, Policy } from './schemas.js';

export type PolicyEvaluationInput = {
  policy: Policy;
  /** Token contract being transferred. Must equal `policy.token`. */
  token: string;
  to: string;
  amount: bigint;
  /** Amount already spent in the current UTC day, as reported by the contract. */
  spentToday: bigint;
  /** Current unix time in seconds (ledger time if known, otherwise wall clock). */
  nowSeconds: number;
  /** Owner pre-approval for `to`, from the contract view `approval(to)`, if any. */
  approval?: OnChainApproval | null;
};

export type PolicyEvaluation =
  | {
      allowed: true;
      /** True when the amount is above the threshold and no usable pre-approval exists. */
      requiresApproval: boolean;
      /** True when a pre-approval satisfies the threshold (it is consumed on use). */
      usesPreApproval: boolean;
      remainingToday: bigint;
    }
  | { allowed: false; code: HaloraErrorCode };

/**
 * Evaluates an agent transfer against the policy. Fails closed: malformed input (negative or
 * zero amounts, unparsable limits) is denied rather than allowed.
 */
export function evaluateAgentPayment(input: PolicyEvaluationInput): PolicyEvaluation {
  const { policy, token, to, amount, spentToday, nowSeconds } = input;
  let perTx: bigint;
  let daily: bigint;
  let threshold: bigint;
  try {
    perTx = BigInt(policy.perTxLimit);
    daily = BigInt(policy.dailyLimit);
    threshold = BigInt(policy.approvalThreshold);
  } catch {
    return { allowed: false, code: 'InvalidPolicy' };
  }
  if (perTx < 0n || daily < 0n || threshold < 0n || spentToday < 0n) {
    return { allowed: false, code: 'InvalidPolicy' };
  }
  if (token !== policy.token) return { allowed: false, code: 'UnsupportedCall' };
  if (typeof amount !== 'bigint' || amount <= 0n)
    return { allowed: false, code: 'UnsupportedCall' };
  if (policy.paused) return { allowed: false, code: 'Paused' };
  if (policy.expiresAt !== 0 && nowSeconds >= policy.expiresAt) {
    return { allowed: false, code: 'Expired' };
  }
  if (policy.allowlistEnabled && !policy.allowlist.includes(to)) {
    return { allowed: false, code: 'RecipientNotAllowed' };
  }
  if (amount > perTx) return { allowed: false, code: 'PerTxLimitExceeded' };
  if (spentToday + amount > daily) return { allowed: false, code: 'DailyLimitExceeded' };
  const aboveThreshold = amount > threshold;
  const usesPreApproval = aboveThreshold && isUsableApproval(input.approval, amount, nowSeconds);
  return {
    allowed: true,
    requiresApproval: aboveThreshold && !usesPreApproval,
    usesPreApproval,
    remainingToday: daily - spentToday - amount,
  };
}

/**
 * True when an on-chain pre-approval covers this transfer: `amount <= approval.amount` and the
 * approval has not expired. Malformed approvals are treated as absent (fail closed).
 */
export function isUsableApproval(
  approval: OnChainApproval | null | undefined,
  amount: bigint,
  nowSeconds: number,
): boolean {
  if (!approval) return false;
  try {
    return amount <= BigInt(approval.amount) && nowSeconds < approval.expiresAt;
  } catch {
    return false;
  }
}

/**
 * Mirrors the contract's `InvalidPolicy` rules so UIs can reject a policy before signing.
 * Returns a list of human-readable issues (empty when valid).
 */
export function validatePolicy(
  policy: Policy,
  context: {
    contractId?: string;
    ownerPublicKey?: string;
    agentPublicKey?: string;
    nowSeconds?: number;
  } = {},
): string[] {
  const issues: string[] = [];
  let perTx: bigint | undefined;
  let daily: bigint | undefined;
  try {
    perTx = BigInt(policy.perTxLimit);
    daily = BigInt(policy.dailyLimit);
    if (perTx < 0n || daily < 0n || BigInt(policy.approvalThreshold) < 0n) {
      issues.push('Limits must not be negative.');
    }
  } catch {
    issues.push('Limits must be integer base-unit strings.');
  }
  if (perTx !== undefined && daily !== undefined && perTx > daily) {
    issues.push('The per-payment limit must not exceed the daily limit.');
  }
  if (policy.allowlist.length > MAX_ALLOWLIST_LENGTH) {
    issues.push(`The allowlist may contain at most ${MAX_ALLOWLIST_LENGTH} addresses.`);
  }
  if (policy.allowlistEnabled && policy.allowlist.length === 0) {
    issues.push('The allowlist is enabled but empty.');
  }
  const now = context.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (policy.expiresAt !== 0 && policy.expiresAt <= now) {
    issues.push('The expiry is already in the past.');
  }
  if (context.contractId && policy.token === context.contractId) {
    issues.push('The token must not be the account itself.');
  }
  if (context.ownerPublicKey && context.ownerPublicKey === context.agentPublicKey) {
    issues.push('The owner key and the agent key must be different.');
  }
  return issues;
}

/** UTC day bucket for a unix timestamp, matching the contract (`timestamp / 86400`). */
export function utcDayBucket(nowSeconds: number): number {
  return Math.floor(nowSeconds / SECONDS_PER_DAY);
}

/** Remaining daily allowance (never negative). */
export function remainingDailyAllowance(policy: Policy, spentToday: bigint): bigint {
  const remaining = BigInt(policy.dailyLimit) - spentToday;
  return remaining > 0n ? remaining : 0n;
}
