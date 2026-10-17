import { describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { ExpiryWorker } from '../src/workers/expiry';
import { silentLogger } from '../src/utils/logger';
import { login, makeHarness, registerAccount, type Harness } from './helpers';

const TX = 'ab'.repeat(32);

async function setup() {
  const h = makeHarness();
  const owner = Keypair.random();
  const ownerToken = await login(h, owner);
  const acct = await registerAccount(h, owner, ownerToken);
  const recipient = Keypair.random().publicKey();
  return { h, owner, ownerToken, ...acct, recipient };
}

async function createApproval(
  h: Harness,
  apiKey: string,
  body: { contractId: string; token: string; to: string; amount?: string },
) {
  return h.call('POST', '/v1/approvals', {
    token: apiKey,
    body: { amount: '250000000', reason: 'Dataset purchase for the report', ...body },
  });
}

describe('approvals', () => {
  test('agent creates, owner approves after on-chain approve_payment, agent sees approved', async () => {
    const s = await setup();
    const created = await createApproval(s.h, s.apiKey, {
      contractId: s.contractId,
      token: s.token,
      to: s.recipient,
    });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      contractId: s.contractId,
      to: s.recipient,
      amount: '250000000',
      status: 'pending',
      expiresAt: '2026-10-16T13:00:00.000Z',
    });
    const id = created.json.id;

    // Owner has not called approve_payment yet: the API refuses to mark it approved.
    const early = await s.h.call('POST', `/v1/approvals/${id}/approve`, {
      token: s.ownerToken,
      body: { approvalTxHash: TX },
    });
    expect(early.status).toBe(422);
    expect(early.json.error.code).toBe('approval_not_on_chain');

    s.h.chain.approvals.set(`${s.contractId}:${s.recipient}`, {
      amount: 250000000n,
      expiresAt: Math.floor(s.h.clock.now.getTime() / 1000) + 600,
    });
    const approved = await s.h.call('POST', `/v1/approvals/${id}/approve`, {
      token: s.ownerToken,
      body: { approvalTxHash: TX.toUpperCase() },
    });
    expect(approved.status).toBe(200);
    expect(approved.json.status).toBe('approved');
    expect(approved.json.approvalTxHash).toBe(TX);

    const polled = await s.h.call('GET', `/v1/approvals/${id}`, { token: s.apiKey });
    expect(polled.json.status).toBe('approved');

    const again = await s.h.call('POST', `/v1/approvals/${id}/approve`, {
      token: s.ownerToken,
      body: { approvalTxHash: TX },
    });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe('approval_not_pending');
  });

  test('refuses on-chain approvals that are too small or expired', async () => {
    const s = await setup();
    const { json } = await createApproval(s.h, s.apiKey, {
      contractId: s.contractId,
      token: s.token,
      to: s.recipient,
    });
    const nowSec = Math.floor(s.h.clock.now.getTime() / 1000);
    s.h.chain.approvals.set(`${s.contractId}:${s.recipient}`, {
      amount: 249999999n,
      expiresAt: nowSec + 600,
    });
    const small = await s.h.call('POST', `/v1/approvals/${json.id}/approve`, {
      token: s.ownerToken,
      body: { approvalTxHash: TX },
    });
    expect(small.status).toBe(422);

    s.h.chain.approvals.set(`${s.contractId}:${s.recipient}`, {
      amount: 250000000n,
      expiresAt: nowSec,
    });
    const expired = await s.h.call('POST', `/v1/approvals/${json.id}/approve`, {
      token: s.ownerToken,
      body: { approvalTxHash: TX },
    });
    expect(expired.status).toBe(422);
  });

  test('fails closed when the chain cannot be read', async () => {
    const s = await setup();
    const { json } = await createApproval(s.h, s.apiKey, {
      contractId: s.contractId,
      token: s.token,
      to: s.recipient,
    });
    s.h.chain.fail = true;
    const res = await s.h.call('POST', `/v1/approvals/${json.id}/approve`, {
      token: s.ownerToken,
      body: { approvalTxHash: TX },
    });
    expect(res.status).toBe(502);
    expect((await s.h.repos.approvals.findById(json.id))?.status).toBe('pending');
  });

  test('creation is idempotent for an identical pending request', async () => {
    const s = await setup();
    const body = { contractId: s.contractId, token: s.token, to: s.recipient };
    const a = await createApproval(s.h, s.apiKey, body);
    const b = await createApproval(s.h, s.apiKey, body);
    expect(b.status).toBe(200);
    expect(b.json.id).toBe(a.json.id);
  });

  test('owner rejects with a reason', async () => {
    const s = await setup();
    const { json } = await createApproval(s.h, s.apiKey, {
      contractId: s.contractId,
      token: s.token,
      to: s.recipient,
    });
    const res = await s.h.call('POST', `/v1/approvals/${json.id}/reject`, {
      token: s.ownerToken,
      body: { reason: 'Not in budget' },
    });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('rejected');
    expect(res.json.rejectionReason).toBe('Not in budget');
  });

  test('authorization boundaries', async () => {
    const s = await setup();
    const { json } = await createApproval(s.h, s.apiKey, {
      contractId: s.contractId,
      token: s.token,
      to: s.recipient,
    });
    // Agent cannot approve its own request.
    const selfApprove = await s.h.call('POST', `/v1/approvals/${json.id}/approve`, {
      token: s.apiKey,
      body: { approvalTxHash: TX },
    });
    expect(selfApprove.status).toBe(403);

    // An agent cannot create approvals for another account.
    const other = await registerAccount(s.h, s.owner, s.ownerToken);
    const cross = await createApproval(s.h, other.apiKey, {
      contractId: s.contractId,
      token: s.token,
      to: s.recipient,
    });
    expect(cross.status).toBe(403);

    // Another agent cannot read it.
    const peek = await s.h.call('GET', `/v1/approvals/${json.id}`, { token: other.apiKey });
    expect(peek.status).toBe(404);

    // Another owner cannot read, approve or reject it.
    const strangerToken = await login(s.h, Keypair.random());
    for (const [method, path, body] of [
      ['GET', `/v1/approvals/${json.id}`, undefined],
      ['POST', `/v1/approvals/${json.id}/approve`, { approvalTxHash: TX }],
      ['POST', `/v1/approvals/${json.id}/reject`, {}],
    ] as const) {
      const res = await s.h.call(method, path, { token: strangerToken, body });
      expect(res.status).toBe(404);
    }
    const strangerList = await s.h.call('GET', '/v1/approvals', { token: strangerToken });
    expect(strangerList.json.approvals).toEqual([]);

    // Owner list covers all of their accounts, filterable by status.
    const ownerList = await s.h.call('GET', '/v1/approvals?status=pending', {
      token: s.ownerToken,
    });
    expect(ownerList.json.approvals.map((a: { id: string }) => a.id)).toEqual([json.id]);
  });

  test('expiry: lazy on read, persisted by the worker, and blocks approval', async () => {
    const s = await setup();
    const { json } = await s.h.call('POST', '/v1/approvals', {
      token: s.apiKey,
      body: {
        contractId: s.contractId,
        token: s.token,
        to: s.recipient,
        amount: '1000',
        reason: 'short-lived',
        expiresInSeconds: 60,
      },
    });
    expect(json.expiresAt).toBe('2026-10-16T12:01:00.000Z');
    s.h.clock.now = new Date(s.h.clock.now.getTime() + 60_000);
    const read = await s.h.call('GET', `/v1/approvals/${json.id}`, { token: s.apiKey });
    expect(read.json.status).toBe('expired');

    const worker = new ExpiryWorker(s.h.repos, silentLogger, () => s.h.clock.now);
    expect((await worker.tick()).approvals).toBe(1);
    expect((await s.h.repos.approvals.findById(json.id))?.status).toBe('expired');

    const res = await s.h.call('POST', `/v1/approvals/${json.id}/approve`, {
      token: s.ownerToken,
      body: { approvalTxHash: TX },
    });
    expect(res.status).toBe(409);
  });

  test('validates bodies', async () => {
    const s = await setup();
    const bad = await s.h.call('POST', '/v1/approvals', {
      token: s.apiKey,
      body: {
        contractId: s.contractId,
        token: s.token,
        to: s.recipient,
        amount: '1.5',
        reason: 'x',
      },
    });
    expect(bad.status).toBe(400);
    const unknownField = await createApproval(s.h, s.apiKey, {
      contractId: s.contractId,
      token: s.token,
      to: s.recipient,
      // @ts-expect-error extra fields are rejected
      extra: true,
    });
    expect(unknownField.status).toBe(400);
    const badHash = await s.h.call(
      'POST',
      '/v1/approvals/00000000-0000-4000-8000-000000000000/approve',
      { token: s.ownerToken, body: { approvalTxHash: 'xyz' } },
    );
    expect(badHash.status).toBe(400);
  });
});
