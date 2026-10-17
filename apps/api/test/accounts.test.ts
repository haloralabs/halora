import { describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { login, makeHarness, randomContractId, registerAccount } from './helpers';

describe('accounts', () => {
  test('registers an account the caller owns on-chain and lists it', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const token = await login(h, owner);
    const { contractId, agent } = await registerAccount(h, owner, token);

    const list = await h.call('GET', '/v1/accounts', { token });
    expect(list.status).toBe(200);
    expect(list.json.accounts).toHaveLength(1);
    const [account] = list.json.accounts;
    expect(account).toEqual({
      contractId,
      ownerPublicKey: owner.publicKey(),
      agentPublicKey: agent.publicKey(),
      label: 'research agent',
      network: 'testnet',
      createdAt: '2026-10-16T12:00:00.000Z',
    });
    expect(JSON.stringify(list.json)).not.toContain('apiKey');
  });

  test('refuses to register a contract owned by someone else', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const token = await login(h, owner);
    const contractId = randomContractId();
    h.chain.accounts.set(contractId, {
      owner: Keypair.random().publicKey(),
      agent: Keypair.random().publicKey(),
      token: randomContractId(),
    });
    const res = await h.call('POST', '/v1/accounts', { token, body: { contractId, label: 'x' } });
    expect(res.status).toBe(403);
  });

  test('fails closed when the contract cannot be read', async () => {
    const h = makeHarness();
    const token = await login(h, Keypair.random());
    const res = await h.call('POST', '/v1/accounts', {
      token,
      body: { contractId: randomContractId(), label: 'x' },
    });
    expect(res.status).toBe(502);
    expect(res.json.error.code).toBe('chain_unavailable');
  });

  test('rejects duplicate registration', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const token = await login(h, owner);
    const { contractId } = await registerAccount(h, owner, token);
    const res = await h.call('POST', '/v1/accounts', {
      token,
      body: { contractId, label: 'again' },
    });
    expect(res.status).toBe(409);
  });

  test('requires authentication and validates the body', async () => {
    const h = makeHarness();
    expect((await h.call('GET', '/v1/accounts')).status).toBe(401);
    const token = await login(h, Keypair.random());
    const res = await h.call('POST', '/v1/accounts', {
      token,
      body: { contractId: 'GABC', label: '' },
    });
    expect(res.status).toBe(400);
  });

  test('payment log is readable by the owner and the account agent only', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const token = await login(h, owner);
    const { contractId, apiKey } = await registerAccount(h, owner, token);
    await h.repos.payments.insertMany([
      {
        id: 'evt-1',
        contractId,
        token: randomContractId(),
        to: Keypair.random().publicKey(),
        amount: '5000000',
        txHash: 'a'.repeat(64),
        ledger: 10,
        createdAt: '2026-10-16T11:00:00.000Z',
        source: 'direct',
      },
    ]);
    const byOwner = await h.call('GET', `/v1/accounts/${contractId}/payments`, { token });
    expect(byOwner.status).toBe(200);
    expect(byOwner.json.payments).toHaveLength(1);
    const byAgent = await h.call('GET', `/v1/accounts/${contractId}/payments?limit=5`, {
      token: apiKey,
    });
    expect(byAgent.status).toBe(200);

    const stranger = await login(h, Keypair.random());
    const byStranger = await h.call('GET', `/v1/accounts/${contractId}/payments`, {
      token: stranger,
    });
    expect(byStranger.status).toBe(404);
  });

  test('health and unknown routes', async () => {
    const h = makeHarness();
    expect((await h.call('GET', '/health')).json).toEqual({ status: 'ok' });
    const missing = await h.call('GET', '/v1/nope');
    expect(missing.status).toBe(404);
    expect(missing.json.error.code).toBe('not_found');
  });

  test('rate limits per client', async () => {
    const h = makeHarness({ rateLimitPerMinute: 3 });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await h.call('GET', '/v1/accounts')).status);
    expect(statuses).toEqual([401, 401, 401, 429, 429]);
    // Health is never limited.
    expect((await h.call('GET', '/health')).status).toBe(200);
  });
});
