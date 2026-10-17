import { describe, expect, test } from 'bun:test';
import { isAccountId } from './strkey.js';
import {
  DEFAULT_RPC_URLS,
  I128_MAX,
  isNetwork,
  NETWORK_PASSPHRASES,
  resolveRpcUrl,
  USDC_ISSUERS,
} from './constants.js';

describe('constants', () => {
  test('network passphrases', () => {
    expect(NETWORK_PASSPHRASES.testnet).toBe('Test SDF Network ; September 2015');
    expect(NETWORK_PASSPHRASES.mainnet).toBe('Public Global Stellar Network ; September 2015');
  });

  test('rpc resolution fails closed on mainnet without override', () => {
    expect(resolveRpcUrl('testnet')).toBe(DEFAULT_RPC_URLS.testnet!);
    expect(() => resolveRpcUrl('mainnet')).toThrow(/explicit rpcUrl/);
    expect(resolveRpcUrl('mainnet', 'https://rpc.example.com')).toBe('https://rpc.example.com');
  });

  test('misc', () => {
    expect(isNetwork('testnet')).toBe(true);
    expect(isNetwork('futurenet')).toBe(false);
    expect(I128_MAX.toString()).toBe('170141183460469231731687303715884105727');
    expect(isAccountId(USDC_ISSUERS.testnet)).toBe(true);
    expect(isAccountId(USDC_ISSUERS.mainnet)).toBe(true);
  });
});
