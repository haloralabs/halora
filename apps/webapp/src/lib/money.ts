/**
 * Token amount helpers. Amounts travel as integer base-unit strings and are handled as
 * bigint so no precision is lost. Stellar USDC uses 7 decimals.
 */

export const USDC_DECIMALS = 7;

const DECIMAL_INPUT = /^\d+(\.\d+)?$/;

/** Parse a human decimal string ("12.5") into base units ("125000000"). Throws on bad input. */
export function toBaseUnits(input: string, decimals = USDC_DECIMALS): string {
  const value = input.trim().replace(/,/g, '');
  if (!DECIMAL_INPUT.test(value)) {
    throw new Error('Enter a positive number, for example 12.50');
  }
  const [whole = '0', fraction = ''] = value.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Use at most ${decimals} decimal places`);
  }
  const units =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  return units.toString();
}

/** Safe variant of toBaseUnits that returns null instead of throwing. */
export function tryToBaseUnits(input: string, decimals = USDC_DECIMALS): string | null {
  try {
    return toBaseUnits(input, decimals);
  } catch {
    return null;
  }
}

/** Format base units as a plain decimal string without trailing zeros ("125000000" to "12.5"). */
export function fromBaseUnits(units: string | bigint, decimals = USDC_DECIMALS): string {
  const value = typeof units === 'bigint' ? units : BigInt(units);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Display format: thousands separators and 2 decimals minimum, more only when needed
 * (micropayments such as 0.0035 USDC keep their precision).
 */
export function formatAmount(units: string | bigint, decimals = USDC_DECIMALS): string {
  const plain = fromBaseUnits(units, decimals);
  const negative = plain.startsWith('-');
  const [whole = '0', fraction = ''] = plain.replace('-', '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = fraction.length < 2 ? fraction.padEnd(2, '0') : fraction;
  return `${negative ? '-' : ''}${grouped}.${frac}`;
}

/** Ratio used by meters, clamped to [0, 1]. A zero limit reads as fully used. */
export function ratio(part: string | bigint, total: string | bigint): number {
  const p = BigInt(part);
  const t = BigInt(total);
  if (t <= 0n) return 1;
  if (p <= 0n) return 0;
  if (p >= t) return 1;
  return Number((p * 10_000n) / t) / 10_000;
}

export function subtractFloor(a: string | bigint, b: string | bigint): string {
  const diff = BigInt(a) - BigInt(b);
  return (diff < 0n ? 0n : diff).toString();
}
