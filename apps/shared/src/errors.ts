/**
 * Contract error map for `halora-account` (`#[contracterror]`, u32). Must stay in sync with
 * docs/architecture/interfaces.md section 1 and the Rust enum in apps/contracts.
 */

export const HALORA_ERROR_CODES = [
  'NotInitialized',
  'InvalidSignature',
  'UnsupportedCall',
  'Paused',
  'Expired',
  'RecipientNotAllowed',
  'PerTxLimitExceeded',
  'DailyLimitExceeded',
  'ApprovalRequired',
  'InvalidPolicy',
] as const;

export type HaloraErrorCode = (typeof HALORA_ERROR_CODES)[number];

export type HaloraErrorInfo = {
  /** u32 discriminant used by the contract. */
  code: number;
  name: HaloraErrorCode;
  /** Human-readable English message, safe to show to owners and agents. */
  message: string;
};

export const HALORA_ERRORS: Readonly<Record<HaloraErrorCode, HaloraErrorInfo>> = Object.freeze({
  NotInitialized: {
    code: 1,
    name: 'NotInitialized',
    message: 'The agent account has not been initialized.',
  },
  InvalidSignature: {
    code: 2,
    name: 'InvalidSignature',
    message: 'The signature is invalid or was not made by the registered agent or owner key.',
  },
  UnsupportedCall: {
    code: 3,
    name: 'UnsupportedCall',
    message: 'The agent key may only transfer the policy token from this account.',
  },
  Paused: {
    code: 4,
    name: 'Paused',
    message: 'The agent account is paused by its owner.',
  },
  Expired: {
    code: 5,
    name: 'Expired',
    message: 'The spending policy has expired.',
  },
  RecipientNotAllowed: {
    code: 6,
    name: 'RecipientNotAllowed',
    message: 'The recipient is not on the allowlist.',
  },
  PerTxLimitExceeded: {
    code: 7,
    name: 'PerTxLimitExceeded',
    message: 'The amount exceeds the per-payment limit.',
  },
  DailyLimitExceeded: {
    code: 8,
    name: 'DailyLimitExceeded',
    message: 'The payment would exceed the daily spending limit.',
  },
  ApprovalRequired: {
    code: 9,
    name: 'ApprovalRequired',
    message: 'The amount is above the approval threshold and needs the owner co-signature.',
  },
  InvalidPolicy: {
    code: 10,
    name: 'InvalidPolicy',
    message:
      'The policy is invalid (for example a negative limit or a per-payment limit above the daily limit).',
  },
});

const BY_CODE: ReadonlyMap<number, HaloraErrorInfo> = new Map(
  Object.values(HALORA_ERRORS).map((info) => [info.code, info]),
);

/** Looks up an error by its u32 contract code. Returns undefined for unknown codes. */
export function haloraErrorFromCode(code: number): HaloraErrorInfo | undefined {
  return BY_CODE.get(code);
}

export function isHaloraErrorCode(value: unknown): value is HaloraErrorCode {
  return typeof value === 'string' && (HALORA_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Extracts a `halora-account` error from a Soroban error string such as
 * "HostError: Error(Contract, #7)". Returns undefined if no known contract code is present.
 * Note: a contract error code alone does not prove which contract raised it; callers should
 * only use this on results of invocations that went through the Halora account.
 */
export function parseHaloraContractError(message: string): HaloraErrorInfo | undefined {
  const match = /Error\(Contract, #(\d+)\)/.exec(message);
  if (!match?.[1]) return undefined;
  return haloraErrorFromCode(Number(match[1]));
}

/**
 * Typed error for a payment that the policy would reject. Thrown by the SDK's local pre-flight
 * check and when a submission fails with a known contract error. The contract remains the
 * source of truth; a passing pre-flight does not guarantee the on-chain check passes.
 */
export class HaloraPolicyError extends Error {
  readonly code: HaloraErrorCode;
  readonly contractCode: number;

  constructor(code: HaloraErrorCode, detail?: string) {
    const info = HALORA_ERRORS[code];
    super(detail ? `${info.message} ${detail}` : info.message);
    this.name = 'HaloraPolicyError';
    this.code = code;
    this.contractCode = info.code;
  }
}

export function isHaloraPolicyError(value: unknown): value is HaloraPolicyError {
  return value instanceof HaloraPolicyError;
}
