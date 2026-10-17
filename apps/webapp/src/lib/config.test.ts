import { describe, expect, test } from 'bun:test';
import { readConfig } from './config';

describe('readConfig', () => {
  test('defaults to mock mode on testnet', () => {
    expect(readConfig({})).toMatchObject({ dataMode: 'mock', network: 'testnet' });
  });
  test('selects live mode from the environment', () => {
    expect(readConfig({ NEXT_PUBLIC_HALORA_DATA_MODE: 'live' }).dataMode).toBe('live');
  });
  test('falls back to safe defaults on invalid values', () => {
    expect(
      readConfig({ NEXT_PUBLIC_HALORA_DATA_MODE: 'prod', NEXT_PUBLIC_HALORA_API_URL: 'nope' })
        .dataMode,
    ).toBe('mock');
  });
});
