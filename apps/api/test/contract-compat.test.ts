import { describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import {
  AgentAccountSchema,
  ApprovalRequestSchema,
  CreateApprovalBodySchema,
  PaymentRecordSchema,
  RegisterAccountBodySchema,
} from '@halora/shared';
import { login, makeHarness, randomContractId } from './helpers';

/** Requests built with, and responses validated by, the @halora/shared schemas the SDK uses. */
describe('compatibility with @halora/shared schemas', () => {
  test('register, create approval, read approval and payments round-trip', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const agent = Keypair.random();
    const ownerToken = await login(h, owner);
    const contractId = randomContractId();
    const token = randomContractId();
    h.chain.accounts.set(contractId, { owner: owner.publicKey(), agent: agent.publicKey(), token });

    const register = await h.call('POST', '/v1/accounts', {
      token: ownerToken,
      body: RegisterAccountBodySchema.parse({
        contractId,
        label: 'compat',
        agentPublicKey: agent.publicKey(),
        network: 'testnet',
      }),
    });
    expect(register.status).toBe(201);
    AgentAccountSchema.parse(register.json.account);

    const mismatch = await h.call('POST', '/v1/accounts', {
      token: ownerToken,
      body: { contractId, label: 'x', network: 'mainnet' },
    });
    expect(mismatch.status).toBe(400);

    // The SDK sends an empty reason when the caller gave none.
    const created = await h.call('POST', '/v1/approvals', {
      token: register.json.apiKey,
      body: CreateApprovalBodySchema.parse({
        contractId,
        token,
        to: Keypair.random().publicKey(),
        amount: '123',
        reason: '',
      }),
    });
    expect(created.status).toBe(201);
    ApprovalRequestSchema.parse(created.json);
    const read = await h.call('GET', `/v1/approvals/${created.json.id}`, {
      token: register.json.apiKey,
    });
    ApprovalRequestSchema.parse(read.json);

    await h.repos.payments.insertMany([
      {
        id: '0000000001-0000000001',
        contractId,
        token,
        to: Keypair.random().publicKey(),
        amount: '5',
        txHash: 'e'.repeat(64),
        ledger: 1,
        createdAt: '2026-10-16T11:00:00.000Z',
        source: 'direct',
      },
    ]);
    const payments = await h.call('GET', `/v1/accounts/${contractId}/payments`, {
      token: ownerToken,
    });
    for (const p of payments.json.payments) PaymentRecordSchema.parse(p);
  });
});
