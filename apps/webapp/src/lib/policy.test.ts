import { describe, expect, test } from 'bun:test';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { DEFAULT_POLICY_FORM, policyFromForm, policyToForm, validatePolicy } from './policy';

const TOKEN = StrKey.encodeContract(Buffer.alloc(32, 7));
const NOW = Date.parse('2026-10-16T12:00:00Z');

describe('policyFromForm', () => {
  test('converts valid form values into an on-chain policy', () => {
    const result = policyFromForm({ ...DEFAULT_POLICY_FORM, expiresOn: '2027-01-31' }, TOKEN, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.policy).toEqual({
      token: TOKEN,
      perTxLimit: '250000000',
      dailyLimit: '1000000000',
      approvalThreshold: '100000000',
      allowlistEnabled: false,
      allowlist: [],
      expiresAt: Date.parse('2027-01-31T23:59:59Z') / 1000,
      paused: false,
    });
  });

  test('rejects a daily limit below the per payment limit', () => {
    const result = policyFromForm(
      { ...DEFAULT_POLICY_FORM, perTxLimit: '50', dailyLimit: '20' },
      TOKEN,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.dailyLimit).toContain('at least the per payment limit');
  });

  test('rejects past expiry, bad numbers and an empty enabled allowlist', () => {
    const result = policyFromForm(
      {
        ...DEFAULT_POLICY_FORM,
        perTxLimit: 'ten',
        allowlistEnabled: true,
        expiresOn: '2020-01-01',
      },
      TOKEN,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.perTxLimit).toBeDefined();
    const second = policyFromForm(
      { ...DEFAULT_POLICY_FORM, allowlistEnabled: true, expiresOn: '2020-01-01' },
      TOKEN,
      NOW,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.errors.expiresOn).toBeDefined();
      expect(second.errors.allowlist).toBeDefined();
    }
  });

  test('round-trips through policyToForm', () => {
    const recipient = Keypair.random().publicKey();
    const form = { ...DEFAULT_POLICY_FORM, allowlistEnabled: true, allowlist: [recipient] };
    const result = policyFromForm(form, TOKEN, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(policyToForm(result.policy)).toEqual(form);
  });
});

describe('validatePolicy', () => {
  test('flags invalid recipients (checksum verified) and allowlists over 50', () => {
    const base = policyFromForm(DEFAULT_POLICY_FORM, TOKEN, NOW);
    if (!base.ok) throw new Error('fixture');
    const bad = 'G' + 'A'.repeat(55);
    expect(
      validatePolicy({ ...base.policy, allowlistEnabled: true, allowlist: [bad] }, NOW)[0]?.field,
    ).toBe('allowlist');
    const many = Array.from({ length: 51 }, () => Keypair.random().publicKey());
    expect(
      validatePolicy({ ...base.policy, allowlist: many }, NOW).some((p) =>
        p.message.includes('at most 50'),
      ),
    ).toBe(true);
  });
});
