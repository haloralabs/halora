import { describe, expect, test } from 'bun:test';
import {
  formatAmount,
  fromBaseUnits,
  ratio,
  subtractFloor,
  toBaseUnits,
  tryToBaseUnits,
} from './money';

describe('money', () => {
  test('converts decimal USDC to base units without floating point', () => {
    expect(toBaseUnits('12.5')).toBe('125000000');
    expect(toBaseUnits('0.0000001')).toBe('1');
    expect(toBaseUnits('1,500')).toBe('15000000000');
    expect(toBaseUnits('0.1')).toBe('1000000');
  });

  test('rejects invalid or over-precise input', () => {
    expect(() => toBaseUnits('-1')).toThrow();
    expect(() => toBaseUnits('abc')).toThrow();
    expect(() => toBaseUnits('0.00000001')).toThrow('7 decimal');
    expect(tryToBaseUnits('')).toBeNull();
  });

  test('round-trips and formats for display', () => {
    expect(fromBaseUnits('125000000')).toBe('12.5');
    expect(fromBaseUnits(35_000n)).toBe('0.0035');
    expect(formatAmount('15000000000')).toBe('1,500.00');
    expect(formatAmount('35000')).toBe('0.0035');
    expect(formatAmount('0')).toBe('0.00');
  });

  test('ratio clamps and treats a zero limit as fully used', () => {
    expect(ratio('50', '100')).toBe(0.5);
    expect(ratio('150', '100')).toBe(1);
    expect(ratio('0', '100')).toBe(0);
    expect(ratio('1', '0')).toBe(1);
    expect(subtractFloor('10', '25')).toBe('0');
  });
});
