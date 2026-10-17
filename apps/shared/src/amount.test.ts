import { describe, expect, test } from 'bun:test';
import {
  AmountError,
  baseUnitsToBigInt,
  bigIntToBaseUnits,
  formatAmount,
  formatUsdc,
  isBaseUnitString,
  parseAmount,
  parseUsdc,
} from './amount.js';
import { I128_MAX } from './constants.js';

describe('base unit strings', () => {
  test('accepts canonical non-negative integers', () => {
    expect(isBaseUnitString('0')).toBe(true);
    expect(isBaseUnitString('12500000')).toBe(true);
    expect(isBaseUnitString(I128_MAX.toString())).toBe(true);
  });

  test('rejects non-canonical, negative, fractional and oversized values', () => {
    for (const bad of ['', '01', '-1', '1.5', '1e7', ' 1', '0x10', (I128_MAX + 1n).toString()]) {
      expect(isBaseUnitString(bad)).toBe(false);
    }
    expect(isBaseUnitString(5 as unknown)).toBe(false);
  });

  test('round-trips bigint', () => {
    expect(baseUnitsToBigInt('9007199254740993')).toBe(9007199254740993n);
    expect(bigIntToBaseUnits(9007199254740993n)).toBe('9007199254740993');
    expect(() => bigIntToBaseUnits(-1n)).toThrow(AmountError);
    expect(() => baseUnitsToBigInt('abc')).toThrow(AmountError);
  });
});

describe('parseAmount', () => {
  test('parses USDC with 7 decimals', () => {
    expect(parseUsdc('1')).toBe(10_000_000n);
    expect(parseUsdc('1.25')).toBe(12_500_000n);
    expect(parseUsdc('0.0000001')).toBe(1n);
    expect(parseUsdc(' 2.5 ')).toBe(25_000_000n);
  });

  test('rejects precision loss instead of rounding', () => {
    expect(() => parseUsdc('0.00000001')).toThrow(AmountError);
  });

  test('rejects malformed input', () => {
    for (const bad of ['', '-1', '1.', '.5', '1,000', 'abc', '1e3']) {
      expect(() => parseUsdc(bad)).toThrow(AmountError);
    }
  });

  test('supports other decimals', () => {
    expect(parseAmount('3', 0)).toBe(3n);
    expect(parseAmount('1.5', 2)).toBe(150n);
    expect(() => parseAmount('1', -1)).toThrow(AmountError);
  });
});

describe('formatAmount', () => {
  test('formats USDC exactly', () => {
    expect(formatUsdc(12_500_000n)).toBe('1.25');
    expect(formatUsdc(10_000_000n)).toBe('1.00');
    expect(formatUsdc(1n)).toBe('0.0000001');
    expect(formatUsdc('0')).toBe('0.00');
    expect(formatUsdc(12_345_678_900_000n, { grouping: true })).toBe('1,234,567.89');
  });

  test('handles negatives and custom min digits', () => {
    expect(formatAmount(-15_000_000n)).toBe('-1.50');
    expect(formatAmount(10_000_000n, 7, { minFractionDigits: 0 })).toBe('1');
    expect(formatAmount(5n, 0)).toBe('5');
  });

  test('round-trips with parse', () => {
    for (const s of ['0.01', '123.4567891', '1000000.00']) {
      expect(formatUsdc(parseUsdc(s))).toBe(s);
    }
  });
});
