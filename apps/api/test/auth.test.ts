import { describe, expect, test } from 'bun:test';
import { Keypair, hash } from '@stellar/stellar-sdk';
import { login, makeHarness, registerAccount } from './helpers';

describe('owner auth', () => {
  test('challenge and raw ed25519 signature produce a working session', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const token = await login(h, owner);
    expect(token.startsWith('hls_')).toBe(true);
    const list = await h.call('GET', '/v1/accounts', { token });
    expect(list.status).toBe(200);
    expect(list.json.accounts).toEqual([]);
  });

  test('challenge message binds domain, key and expiry', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const ch = await h.call('POST', '/v1/auth/challenge', {
      body: { publicKey: owner.publicKey() },
    });
    expect(ch.status).toBe(200);
    expect(ch.json.message).toContain('api.test wants you to sign in');
    expect(ch.json.message).toContain(owner.publicKey());
    expect(ch.json.message).toContain('Expiration Time: 2026-10-16T12:05:00.000Z');
  });

  test('accepts SEP-53 signed messages (wallet signMessage)', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const ch = await h.call('POST', '/v1/auth/challenge', {
      body: { publicKey: owner.publicKey() },
    });
    const digest = hash(Buffer.from(`Stellar Signed Message:\n${ch.json.message}`, 'utf8'));
    const v = await h.call('POST', '/v1/auth/verify', {
      body: {
        publicKey: owner.publicKey(),
        nonce: ch.json.nonce,
        signature: Buffer.from(owner.sign(digest)).toString('base64'),
      },
    });
    expect(v.status).toBe(200);
  });

  test('rejects a signature from another key, and the nonce cannot be retried', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const attacker = Keypair.random();
    const ch = await h.call('POST', '/v1/auth/challenge', {
      body: { publicKey: owner.publicKey() },
    });
    const bad = await h.call('POST', '/v1/auth/verify', {
      body: {
        publicKey: owner.publicKey(),
        nonce: ch.json.nonce,
        signature: Buffer.from(attacker.sign(Buffer.from(ch.json.message))).toString('base64'),
      },
    });
    expect(bad.status).toBe(401);
    expect(bad.json.error.code).toBe('unauthorized');
    const retry = await h.call('POST', '/v1/auth/verify', {
      body: {
        publicKey: owner.publicKey(),
        nonce: ch.json.nonce,
        signature: Buffer.from(owner.sign(Buffer.from(ch.json.message))).toString('base64'),
      },
    });
    expect(retry.status).toBe(401);
  });

  test('rejects an expired challenge', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const ch = await h.call('POST', '/v1/auth/challenge', {
      body: { publicKey: owner.publicKey() },
    });
    h.clock.now = new Date(h.clock.now.getTime() + 301_000);
    const v = await h.call('POST', '/v1/auth/verify', {
      body: {
        publicKey: owner.publicKey(),
        nonce: ch.json.nonce,
        signature: Buffer.from(owner.sign(Buffer.from(ch.json.message))).toString('base64'),
      },
    });
    expect(v.status).toBe(401);
  });

  test('sessions expire', async () => {
    const h = makeHarness();
    const token = await login(h, Keypair.random());
    h.clock.now = new Date(h.clock.now.getTime() + 3601_000);
    expect((await h.call('GET', '/v1/accounts', { token })).status).toBe(401);
  });

  test('validates input', async () => {
    const h = makeHarness();
    const res = await h.call('POST', '/v1/auth/challenge', { body: { publicKey: 'nope' } });
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('validation_error');
    expect(res.json.error.details[0].path).toBe('publicKey');
  });
});

describe('agent auth', () => {
  test('API key authenticates the agent, a tampered key does not', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const ownerToken = await login(h, owner);
    const { contractId, apiKey } = await registerAccount(h, owner, ownerToken);
    expect(apiKey.startsWith('hak_')).toBe(true);

    const ok = await h.call('GET', `/v1/approvals?contractId=${contractId}`, { token: apiKey });
    expect(ok.status).toBe(200);

    const tampered = apiKey.slice(0, -2) + (apiKey.endsWith('AA') ? 'BB' : 'AA');
    const bad = await h.call('GET', '/v1/approvals', { token: tampered });
    expect(bad.status).toBe(401);
  });

  test('the API key is stored only as a hash', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const ownerToken = await login(h, owner);
    const { contractId, apiKey } = await registerAccount(h, owner, ownerToken);
    const stored = await h.repos.accounts.findByContractId(contractId);
    expect(JSON.stringify(stored)).not.toContain(apiKey);
    expect(stored?.apiKeyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('an agent key cannot use owner routes', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const { apiKey } = await registerAccount(h, owner, await login(h, owner));
    const res = await h.call('GET', '/v1/accounts', { token: apiKey });
    expect(res.status).toBe(403);
  });
});
