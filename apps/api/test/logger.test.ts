import { describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { createLogger, redact } from '../src/utils/logger';

describe('logger redaction', () => {
  test('redacts sensitive keys, secret seeds and bearer tokens', () => {
    const seed = Keypair.random().secret();
    const out = redact({
      apiKey: 'hak_abc',
      authorization: 'Bearer hls_xyz',
      nested: { agentSecret: seed, note: `leaked ${seed}`, approvalTxHash: 'ok' },
      err: new Error(`failed with Bearer hls_123 and ${seed}`),
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain(seed);
    expect(text).not.toContain('hak_abc');
    expect(text).not.toContain('hls_');
  });

  test('strips bound query parameters from database errors', () => {
    const err = new Error(
      'Failed query: insert into "owner_sessions" values ($1)\nparams: deadbeef',
    );
    expect(JSON.stringify(redact({ err }))).not.toContain('deadbeef');
  });

  test('writes JSON lines at or above the configured level', () => {
    const lines: string[] = [];
    const log = createLogger('info', (l: string) => lines.push(l));
    log.debug('hidden');
    log.info('shown', { contractId: 'C1' });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: 'info', msg: 'shown', contractId: 'C1' });
  });
});
