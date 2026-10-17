/**
 * Amount helpers. Amounts are always integer base units. In JSON they travel as decimal
 * strings (never JS numbers, which lose precision above 2^53). In code they are bigint.
 */

import { I128_MAX, USDC_DECIMALS } from './constants.js';

const BASE_UNIT_RE = /^(0|[1-9][0-9]*)$/;
const DECIMAL_RE = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmountError';
  }
}

/** True when `value` is a canonical non-negative integer string that fits in i128. */
export function isBaseUnitString(value: unknown): value is string {
  if (typeof value !== 'string' || !BASE_UNIT_RE.test(value)) return false;
  return BigInt(value) <= I128_MAX;
}

/** Parses a base-unit string (for example "12500000") to bigint. Throws on anything else. */
export function baseUnitsToBigInt(value: string): bigint {
  if (!isBaseUnitString(value)) {
    throw new AmountError('amount must be a non-negative integer string of base units');
  }
  return BigInt(value);
}

/** Serializes a non-negative bigint to a base-unit string. Throws on negative or out of range. */
export function bigIntToBaseUnits(value: bigint): string {
  if (typeof value !== 'bigint') throw new AmountError('amount must be a bigint');
  if (value < 0n) throw new AmountError('amount must not be negative');
  if (value > I128_MAX) throw new AmountError('amount exceeds i128 range');
  return value.toString(10);
}

/**
 * Parses a human decimal amount ("1.25") into base units (12500000n for 7 decimals).
 * Rejects more fractional digits than `decimals` instead of rounding: silent rounding of
 * money is a bug.
 */
export function parseAmount(value: string, decimals: number = USDC_DECIMALS): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) {
    throw new AmountError('decimals must be an integer between 0 and 38');
  }
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!DECIMAL_RE.test(trimmed)) {
    throw new AmountError(`invalid amount: expected a non-negative decimal string`);
  }
  const [whole = '0', fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) {
    throw new AmountError(`amount has more than ${decimals} decimal places`);
  }
  const result =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (result > I128_MAX) throw new AmountError('amount exceeds i128 range');
  return result;
}

export type FormatAmountOptions = {
  /** Minimum fractional digits to keep (default 2, capped at `decimals`). */
  minFractionDigits?: number;
  /** Insert thousands separators in the whole part (default false). */
  grouping?: boolean;
};

/**
 * Formats base units as a human decimal string. Exact (no floating point).
 * formatAmount(12500000n) === "1.25"; formatAmount(10000000n) === "1.00".
 */
export function formatAmount(
  value: bigint | string,
  decimals: number = USDC_DECIMALS,
  options: FormatAmountOptions = {},
): string {
  const units = typeof value === 'string' ? baseUnitsToSignedBigInt(value) : value;
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const scale = 10n ** BigInt(decimals);
  let whole = (abs / scale).toString(10);
  let fraction = decimals > 0 ? (abs % scale).toString(10).padStart(decimals, '0') : '';
  const minDigits = Math.min(options.minFractionDigits ?? 2, decimals);
  fraction = fraction.replace(/0+$/, '');
  if (fraction.length < minDigits) fraction = fraction.padEnd(minDigits, '0');
  if (options.grouping) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** USDC convenience wrappers (7 decimals). */
export const parseUsdc = (value: string): bigint => parseAmount(value, USDC_DECIMALS);
export const formatUsdc = (value: bigint | string, options?: FormatAmountOptions): string =>
  formatAmount(value, USDC_DECIMALS, options);

function baseUnitsToSignedBigInt(value: string): bigint {
  if (!/^-?(0|[1-9][0-9]*)$/.test(value)) {
    throw new AmountError('amount must be an integer string of base units');
  }
  return BigInt(value);
}
