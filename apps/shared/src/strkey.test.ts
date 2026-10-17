import { describe, expect, test } from 'bun:test';
import {
  accountIdToPublicKeyHex,
  decodeStrkey,
  encodeStrkey,
  isAccountId,
  isContractId,
  isSecretSeed,
  isStellarAddress,
  publicKeyHexToAccountId,
} from './strkey.js';

// Well-known public values (no secrets): Circle's testnet USDC issuer and its SAC contract ID.
const ACCOUNT = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const CONTRACT = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

describe('strkey', () => {
  test('validates account and contract IDs', () => {
    expect(isAccountId(ACCOUNT)).toBe(true);
    expect(isContractId(CONTRACT)).toBe(true);
    expect(isStellarAddress(ACCOUNT)).toBe(true);
    expect(isStellarAddress(CONTRACT)).toBe(true);
    expect(isAccountId(CONTRACT)).toBe(false);
    expect(isContractId(ACCOUNT)).toBe(false);
  });

  test('rejects bad checksum, wrong length, lowercase and non-strings', () => {
    const flipped = ACCOUNT.slice(0, -1) + (ACCOUNT.endsWith('A') ? 'B' : 'A');
    expect(isAccountId(flipped)).toBe(false);
    expect(isAccountId(ACCOUNT.slice(1))).toBe(false);
    expect(isAccountId(ACCOUNT.toLowerCase())).toBe(false);
    expect(isAccountId(null)).toBe(false);
    expect(isStellarAddress('')).toBe(false);
  });

  test('round-trips encode/decode', () => {
    const payload = decodeStrkey('ed25519PublicKey', ACCOUNT);
    expect(payload).not.toBeNull();
    expect(encodeStrkey('ed25519PublicKey', payload!)).toBe(ACCOUNT);
    const seed = encodeStrkey('ed25519SecretSeed', new Uint8Array(32).fill(7));
    expect(seed.startsWith('S')).toBe(true);
    expect(isSecretSeed(seed)).toBe(true);
    expect(isAccountId(seed)).toBe(false);
  });

  test('converts between hex public keys and account IDs', () => {
    const hex = accountIdToPublicKeyHex(ACCOUNT);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(publicKeyHexToAccountId(hex)).toBe(ACCOUNT);
    expect(() => publicKeyHexToAccountId('zz')).toThrow();
    expect(() => accountIdToPublicKeyHex(CONTRACT)).toThrow();
  });
});
