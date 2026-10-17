import { describe, expect, test } from 'bun:test';
import {
  evaluateAgentPayment,
  isUsableApproval,
  remainingDailyAllowance,
  utcDayBucket,
  validatePolicy,
} from './policy.js';
import type { Policy } from './schemas.js';

const TOKEN = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const TO = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const policy: Policy = {
  token: TOKEN,
  perTxLimit: '100',
  dailyLimit: '250',
  approvalThreshold: '50',
  allowlistEnabled: false,
  allowlist: [],
  expiresAt: 0,
  paused: false,
};

const base = { policy, token: TOKEN, to: TO, amount: 10n, spentToday: 0n, nowSeconds: 1_000 };

describe('evaluateAgentPayment', () => {
  test('allows within limits', () => {
    expect(evaluateAgentPayment(base)).toEqual({
      allowed: true,
      requiresApproval: false,
      usesPreApproval: false,
      remainingToday: 240n,
    });
  });

  test('flags approval above threshold (strictly greater)', () => {
    expect(evaluateAgentPayment({ ...base, amount: 50n })).toMatchObject({
      requiresApproval: false,
    });
    expect(evaluateAgentPayment({ ...base, amount: 51n })).toMatchObject({
      requiresApproval: true,
    });
  });

  test('denies in contract order', () => {
    const deny = (over: Partial<typeof base>, p: Partial<Policy> = {}) =>
      evaluateAgentPayment({ ...base, ...over, policy: { ...policy, ...p } });
    expect(deny({ token: TO })).toEqual({ allowed: false, code: 'UnsupportedCall' });
    expect(deny({ amount: 0n })).toEqual({ allowed: false, code: 'UnsupportedCall' });
    expect(deny({}, { paused: true })).toEqual({ allowed: false, code: 'Paused' });
    expect(deny({}, { expiresAt: 1_000 })).toEqual({ allowed: false, code: 'Expired' });
    expect(deny({}, { allowlistEnabled: true })).toEqual({
      allowed: false,
      code: 'RecipientNotAllowed',
    });
    expect(deny({ amount: 101n })).toEqual({ allowed: false, code: 'PerTxLimitExceeded' });
    expect(deny({ spentToday: 200n, amount: 51n })).toEqual({
      allowed: false,
      code: 'DailyLimitExceeded',
    });
    // Paused wins over every later check.
    expect(deny({ amount: 1_000n }, { paused: true, allowlistEnabled: true })).toMatchObject({
      code: 'Paused',
    });
  });

  test('allowlist accepts listed recipient and unexpired policy', () => {
    const r = evaluateAgentPayment({
      ...base,
      nowSeconds: 999,
      policy: { ...policy, allowlistEnabled: true, allowlist: [TO], expiresAt: 1_000 },
    });
    expect(r.allowed).toBe(true);
  });

  test('fails closed on malformed policy values', () => {
    const r = evaluateAgentPayment({ ...base, policy: { ...policy, perTxLimit: 'x' } });
    expect(r).toEqual({ allowed: false, code: 'InvalidPolicy' });
    expect(evaluateAgentPayment({ ...base, spentToday: -1n })).toMatchObject({ allowed: false });
  });
});

describe('pre-approval', () => {
  test('a valid approval satisfies the threshold', () => {
    const r = evaluateAgentPayment({
      ...base,
      amount: 80n,
      approval: { amount: '80', expiresAt: 2_000 },
    });
    expect(r).toMatchObject({ allowed: true, requiresApproval: false, usesPreApproval: true });
  });

  test('expired, too small or malformed approvals do not', () => {
    for (const approval of [
      { amount: '80', expiresAt: 1_000 },
      { amount: '79', expiresAt: 2_000 },
      { amount: 'x', expiresAt: 2_000 },
      null,
    ]) {
      expect(evaluateAgentPayment({ ...base, amount: 80n, approval })).toMatchObject({
        requiresApproval: true,
        usesPreApproval: false,
      });
    }
    expect(isUsableApproval(undefined, 1n, 0)).toBe(false);
  });

  test('approval never bypasses limits', () => {
    const r = evaluateAgentPayment({
      ...base,
      amount: 101n,
      approval: { amount: '1000', expiresAt: 2_000 },
    });
    expect(r).toEqual({ allowed: false, code: 'PerTxLimitExceeded' });
  });
});

describe('validatePolicy', () => {
  test('valid policy has no issues', () => {
    expect(validatePolicy(policy, { nowSeconds: 0 })).toEqual([]);
  });

  test('reports contract InvalidPolicy rules', () => {
    const issues = validatePolicy(
      { ...policy, perTxLimit: '300', allowlistEnabled: true, expiresAt: 5, token: TOKEN },
      { nowSeconds: 10, contractId: TOKEN, ownerPublicKey: TO, agentPublicKey: TO },
    );
    expect(issues.length).toBe(5);
  });
});

describe('helpers', () => {
  test('utc day bucket and remaining allowance', () => {
    expect(utcDayBucket(86_399)).toBe(0);
    expect(utcDayBucket(86_400)).toBe(1);
    expect(remainingDailyAllowance(policy, 100n)).toBe(150n);
    expect(remainingDailyAllowance(policy, 300n)).toBe(0n);
  });
});
