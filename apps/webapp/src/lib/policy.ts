import { StrKey } from '@stellar/stellar-sdk';
import { z } from 'zod';
import type { Policy } from './domain';
import { fromBaseUnits, tryToBaseUnits } from './money';

export type PolicyProblem = { field: keyof PolicyFormValues | 'policy'; message: string };

/**
 * Client-side policy rules. These mirror what the contract rejects with `InvalidPolicy` so the
 * owner sees the problem before signing. The contract stays the source of truth.
 */
export const MAX_ALLOWLIST = 50;

export function validatePolicy(policy: Policy, now: number = Date.now()): PolicyProblem[] {
  const problems: PolicyProblem[] = [];
  const perTx = BigInt(policy.perTxLimit);
  const daily = BigInt(policy.dailyLimit);
  const threshold = BigInt(policy.approvalThreshold);
  if (perTx <= 0n)
    problems.push({ field: 'perTxLimit', message: 'The per payment limit must be above zero.' });
  if (daily <= 0n)
    problems.push({ field: 'dailyLimit', message: 'The daily limit must be above zero.' });
  if (daily < perTx) {
    problems.push({
      field: 'dailyLimit',
      message: 'The daily limit must be at least the per payment limit.',
    });
  }
  if (threshold < 0n)
    problems.push({
      field: 'approvalThreshold',
      message: 'The approval threshold cannot be negative.',
    });
  if (policy.allowlistEnabled && policy.allowlist.length === 0) {
    problems.push({
      field: 'allowlist',
      message: 'Add at least one recipient, or turn the allowlist off.',
    });
  }
  if (policy.allowlist.length > MAX_ALLOWLIST) {
    problems.push({
      field: 'allowlist',
      message: `The allowlist can hold at most ${MAX_ALLOWLIST} recipients.`,
    });
  }
  if (policy.expiresAt > 0 && policy.expiresAt * 1000 <= now) {
    problems.push({ field: 'expiresOn', message: 'The expiry date must be in the future.' });
  }
  for (const address of policy.allowlist) {
    if (!isValidRecipient(address)) {
      problems.push({
        field: 'allowlist',
        message: `${address.slice(0, 8)}... is not a valid Stellar address.`,
      });
      break;
    }
  }
  if (new Set(policy.allowlist).size !== policy.allowlist.length) {
    problems.push({ field: 'allowlist', message: 'The allowlist contains duplicates.' });
  }
  return problems;
}

/** Recipient may be a classic account (G...) or a contract (C...). Checksums are verified. */
export function isValidRecipient(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address) || StrKey.isValidContract(address);
}

export function isValidAccountKey(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

const decimal = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => tryToBaseUnits(v) !== null, `${label} must be a number with at most 7 decimals`);

/** Shape of the policy form: human decimal strings that become base units on submit. */
export const PolicyFormSchema = z.object({
  perTxLimit: decimal('Per payment limit'),
  dailyLimit: decimal('Daily limit'),
  approvalThreshold: decimal('Approval threshold'),
  allowlistEnabled: z.boolean(),
  allowlist: z.array(z.string().trim()),
  /** yyyy-mm-dd, or empty for no expiry. */
  expiresOn: z.string().trim(),
  paused: z.boolean(),
});
export type PolicyFormValues = z.infer<typeof PolicyFormSchema>;

export type PolicyFormResult =
  | { ok: true; policy: Policy }
  | { ok: false; errors: Partial<Record<keyof PolicyFormValues | 'policy', string>> };

/** Validates form values and converts them to an on-chain policy. */
export function policyFromForm(
  values: PolicyFormValues,
  token: string,
  now = Date.now(),
): PolicyFormResult {
  const parsed = PolicyFormSchema.safeParse(values);
  const errors: Partial<Record<keyof PolicyFormValues | 'policy', string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof PolicyFormValues;
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const v = parsed.data;
  let expiresAt = 0;
  if (v.expiresOn) {
    const ms = Date.parse(`${v.expiresOn}T23:59:59Z`);
    if (Number.isNaN(ms)) errors.expiresOn = 'Enter a valid date';
    else if (ms <= now) errors.expiresOn = 'The expiry date must be in the future';
    else expiresAt = Math.floor(ms / 1000);
  }
  const allowlist = v.allowlist.filter((a) => a.length > 0);
  const policy: Policy = {
    token,
    perTxLimit: tryToBaseUnits(v.perTxLimit) ?? '0',
    dailyLimit: tryToBaseUnits(v.dailyLimit) ?? '0',
    approvalThreshold: tryToBaseUnits(v.approvalThreshold) ?? '0',
    allowlistEnabled: v.allowlistEnabled,
    allowlist,
    expiresAt,
    paused: v.paused,
  };
  for (const problem of validatePolicy(policy, now)) errors[problem.field] ??= problem.message;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, policy };
}

/** A human summary of what the policy means for the agent, used on review screens. */
export function describeApprovalRule(policy: Policy): string {
  if (BigInt(policy.approvalThreshold) >= BigInt(policy.perTxLimit)) {
    return 'No payment needs your approval: the threshold is at or above the per payment limit.';
  }
  return 'Payments above the approval threshold need your on-chain approval first.';
}

/** Converts an on-chain policy into editable form values. */
export function policyToForm(policy: Policy): PolicyFormValues {
  return {
    perTxLimit: fromBaseUnits(policy.perTxLimit),
    dailyLimit: fromBaseUnits(policy.dailyLimit),
    approvalThreshold: fromBaseUnits(policy.approvalThreshold),
    allowlistEnabled: policy.allowlistEnabled,
    allowlist: [...policy.allowlist],
    expiresOn:
      policy.expiresAt > 0 ? new Date(policy.expiresAt * 1000).toISOString().slice(0, 10) : '',
    paused: policy.paused,
  };
}

/** Sensible starting point for a new agent: small limits, approval above 10 USDC. */
export const DEFAULT_POLICY_FORM: PolicyFormValues = {
  perTxLimit: '25',
  dailyLimit: '100',
  approvalThreshold: '10',
  allowlistEnabled: false,
  allowlist: [],
  expiresOn: '',
  paused: false,
};
