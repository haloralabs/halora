import { describe, expect, test } from 'bun:test';
import { Asset, Keypair, Networks, StrKey, scValToNative, xdr } from '@stellar/stellar-sdk';
import {
  decodeStrkey,
  encodeStrkey,
  isAccountId,
  isContractId,
  USDC_ISSUERS,
} from '@halora/shared';
import {
  decodeApproval,
  decodeHaloraSignature,
  decodePolicy,
  encodeApproval,
  encodeHaloraSignature,
  encodePolicy,
} from '../src/scval.js';
import { CONTRACT_ID, TOKEN_ID } from './fake-ledger.js';

const policy = {
  token: TOKEN_ID,
  perTxLimit: '10000000',
  dailyLimit: '50000000',
  approvalThreshold: '5000000',
  allowlistEnabled: true,
  allowlist: [CONTRACT_ID, Keypair.random().publicKey()],
  expiresAt: 1_900_000_000,
  paused: false,
};

describe('HaloraSignature encoding', () => {
  const sig = { publicKey: new Uint8Array(32).fill(1), signature: new Uint8Array(64).fill(2) };

  test('Agent is Vec[Symbol("Agent"), Map{public_key, signature}] with sorted symbol keys', () => {
    const val = encodeHaloraSignature({ kind: 'Agent', agent: sig });
    expect(val.type).toBe('scvVec');
    const vec = (val as xdr.ScValVec).vec!;
    expect(vec.length).toBe(2);
    expect(vec[0]!.type).toBe('scvSymbol');
    expect(scValToNative(vec[0]!)).toBe('Agent');
    const map = (vec[1] as xdr.ScValMap).map!;
    expect(map.map((e) => scValToNative(e.key))).toEqual(['public_key', 'signature']);
    expect(map.every((e) => e.key.type === 'scvSymbol' && e.val.type === 'scvBytes')).toBe(true);
  });

  test('round-trips all variants', () => {
    for (const s of [
      { kind: 'Agent', agent: sig },
      { kind: 'Owner', owner: sig },
      { kind: 'AgentWithOwner', agent: sig, owner: sig },
    ] as const) {
      const xdrB64 = encodeHaloraSignature(s).toXdr('base64');
      expect(decodeHaloraSignature(xdr.ScVal.fromXdr(xdrB64, 'base64'))).toEqual(s);
    }
    expect(
      (encodeHaloraSignature({ kind: 'AgentWithOwner', agent: sig, owner: sig }) as xdr.ScValVec)
        .vec!.length,
    ).toBe(3);
  });

  test('rejects malformed signatures', () => {
    expect(() =>
      encodeHaloraSignature({ kind: 'Agent', agent: { ...sig, signature: new Uint8Array(63) } }),
    ).toThrow();
    expect(() => decodeHaloraSignature(xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Root')]))).toThrow();
    expect(() => decodeHaloraSignature(xdr.ScVal.scvVoid())).toThrow();
  });
});

describe('Policy encoding', () => {
  test('uses snake_case sorted fields and round-trips', () => {
    const val = encodePolicy(policy);
    const keys = (val as xdr.ScValMap).map!.map((e) => scValToNative(e.key) as string);
    expect(keys).toEqual([...keys].sort());
    expect(keys).toEqual([
      'allowlist',
      'allowlist_enabled',
      'approval_threshold',
      'daily_limit',
      'expires_at',
      'paused',
      'per_tx_limit',
      'token',
    ]);
    expect(decodePolicy(xdr.ScVal.fromXdr(val.toXdr('base64'), 'base64'))).toEqual(policy);
  });

  test('rejects invalid policy input', () => {
    expect(() => encodePolicy({ ...policy, perTxLimit: '-1' })).toThrow();
  });

  test('approval round-trip and None', () => {
    const a = { amount: '70000000', expiresAt: 1_900_000_000 };
    expect(decodeApproval(encodeApproval(a))).toEqual(a);
    expect(decodeApproval(xdr.ScVal.scvVoid())).toBeNull();
  });
});

describe('shared strkey helpers agree with stellar-sdk', () => {
  test('random keys and contracts', () => {
    for (let i = 0; i < 20; i++) {
      const kp = Keypair.random();
      expect(isAccountId(kp.publicKey())).toBe(true);
      expect(encodeStrkey('ed25519PublicKey', kp.rawPublicKey())).toBe(kp.publicKey());
      const raw = crypto.getRandomValues(new Uint8Array(32));
      const c = StrKey.encodeContract(raw);
      expect(isContractId(c)).toBe(true);
      expect(decodeStrkey('contract', c)).toEqual(raw);
    }
  });

  test('USDC SAC IDs derive from the issuers in constants', () => {
    expect(new Asset('USDC', USDC_ISSUERS.testnet).contractId(Networks.TESTNET)).toBe(CONTRACT_ID);
    expect(new Asset('USDC', USDC_ISSUERS.mainnet).contractId(Networks.PUBLIC)).toBe(TOKEN_ID);
  });
});
