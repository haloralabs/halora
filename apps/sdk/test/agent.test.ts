import { describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { HaloraPolicyError, type ApprovalRequest } from '@halora/shared';
import { HaloraAgent } from '../src/agent.js';
import type { FetchLike } from '../src/api.js';
import { HaloraApprovalError, HaloraSdkError } from '../src/errors.js';
import { CONTRACT_ID, FakeLedger, TOKEN_ID } from './fake-ledger.js';

const API = 'https://api.halora.test';

function setup(policy = {}, withApi = true) {
  const owner = Keypair.random();
  const agentKp = Keypair.random();
  const ledger = new FakeLedger(owner, agentKp, policy);
  const approvals = new Map<string, ApprovalRequest>();
  const requests: { method: string; url: string; auth: string | null; body?: unknown }[] = [];
  const fetchMock: FetchLike = async (input, init) => {
    const url = input.toString();
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method: init?.method ?? 'GET', url, auth: headers.get('authorization'), body });
    if (init?.method === 'POST' && url === `${API}/v1/approvals`) {
      const req: ApprovalRequest = {
        id: `ap_${approvals.size + 1}`,
        ...body,
        status: 'pending',
        createdAt: '2026-10-17T00:00:00.000Z',
        expiresAt: '2026-10-18T00:00:00.000Z',
      };
      approvals.set(req.id, req);
      return Response.json(req, { status: 201 });
    }
    const m = /\/v1\/approvals\/(.+)$/.exec(url);
    if (m && approvals.has(m[1]!)) return Response.json(approvals.get(m[1]!));
    return new Response('not found', { status: 404 });
  };
  const agent = new HaloraAgent({
    contractId: CONTRACT_ID,
    agentSecret: agentKp.secret(),
    network: 'testnet',
    rpc: ledger,
    fetch: fetchMock,
    ...(withApi ? { apiUrl: API, apiKey: 'test-key' } : {}),
    pollIntervalMs: 1,
    approvalPollIntervalMs: 1,
    now: () => ledger.nowSeconds,
    sleep: async () => {},
  });
  return { owner, agentKp, ledger, agent, approvals, requests };
}

const to = Keypair.random().publicKey();

describe('HaloraAgent.pay', () => {
  test('pays within policy with an Agent signature; agent is fee source', async () => {
    const { agent, ledger, agentKp } = setup();
    const res = await agent.pay({ to, amount: 10_000_000n });
    expect(res).toMatchObject({ status: 'paid', to, amount: '10000000', token: TOKEN_ID });
    expect(ledger.spentToday).toBe(10_000_000n);
    const tx = ledger.submitted[0]!;
    expect(tx.source).toBe(agentKp.publicKey());
    expect(
      ledger.simulations.filter((s) => s.fn === 'transfer').map((s) => s.authMode ?? 'record'),
    ).toEqual(['record', 'enforce']);
  });

  test('pre-flight denials are typed and nothing is signed or submitted', async () => {
    const cases: [object, bigint, string][] = [
      [{ paused: true }, 1n, 'Paused'],
      [{ expiresAt: 1 }, 1n, 'Expired'],
      [{ allowlistEnabled: true, allowlist: [TOKEN_ID] }, 1n, 'RecipientNotAllowed'],
      [{}, 100_000_001n, 'PerTxLimitExceeded'],
    ];
    for (const [policy, amount, code] of cases) {
      const { agent, ledger } = setup(policy);
      const err = await agent.pay({ to, amount }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HaloraPolicyError);
      expect((err as HaloraPolicyError).code).toBe(code as HaloraPolicyError['code']);
      expect(ledger.submitted.length).toBe(0);
      expect(ledger.simulations.some((s) => s.fn === 'transfer')).toBe(false);
    }
  });

  test('daily limit is tracked across payments', async () => {
    const { agent } = setup({ dailyLimit: '15000000', perTxLimit: '10000000' });
    await agent.pay({ to, amount: 10_000_000n });
    await expect(agent.pay({ to, amount: 10_000_000n })).rejects.toMatchObject({
      code: 'DailyLimitExceeded',
    });
  });

  test('on-chain denial after a passing pre-flight maps to HaloraPolicyError', async () => {
    const { agent, ledger } = setup();
    // Simulate a race: the pre-flight reads 0, the contract sees a higher spent amount.
    const orig = ledger.simulateTransaction.bind(ledger);
    ledger.simulateTransaction = async (tx, r, mode) => {
      if (mode === 'enforce') ledger.spentToday = 499_000_000n;
      return orig(tx, r, mode);
    };
    await expect(agent.pay({ to, amount: 10_000_000n })).rejects.toMatchObject({
      name: 'HaloraPolicyError',
      code: 'DailyLimitExceeded',
    });
    expect(ledger.submitted.length).toBe(0);
  });

  test('rejects invalid input and secrets without echoing them', () => {
    const { ledger } = setup();
    let msg = '';
    try {
      new HaloraAgent({
        contractId: CONTRACT_ID,
        agentSecret: 'SNOTASECRET',
        network: 'testnet',
        rpc: ledger,
      });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain('not a valid');
    expect(msg).not.toContain('SNOTASECRET');
    expect(
      () =>
        new HaloraAgent({
          contractId: CONTRACT_ID,
          agentSecret: Keypair.random().secret(),
          network: 'testnet',
          rpc: ledger,
          apiUrl: 'http://api.example.com',
          apiKey: 'k',
        }),
    ).toThrow(/https/);
  });

  test('amount must be positive', async () => {
    const { agent } = setup();
    await expect(agent.pay({ to, amount: 0n })).rejects.toThrow(HaloraSdkError);
  });
});

describe('approval flow', () => {
  test('above threshold without API throws ApprovalRequired', async () => {
    const { agent } = setup({}, false);
    await expect(agent.pay({ to, amount: 60_000_000n })).rejects.toMatchObject({
      code: 'ApprovalRequired',
    });
  });

  test('creates an approval request, waits, then pays consuming the pre-approval', async () => {
    const { agent, ledger, approvals, requests } = setup();
    const pending = await agent.pay({ to, amount: 60_000_000n, reason: 'dataset' });
    expect(pending).toMatchObject({ status: 'approval_pending', approvalId: 'ap_1' });
    expect(requests[0]).toMatchObject({
      method: 'POST',
      auth: 'Bearer test-key',
      body: { contractId: CONTRACT_ID, token: TOKEN_ID, to, amount: '60000000', reason: 'dataset' },
    });
    expect(ledger.submitted.length).toBe(0);

    // Owner approves on-chain, API marks it approved after the first poll.
    let polls = 0;
    const origGet = approvals.get.bind(approvals);
    approvals.get = (id: string) => {
      const a = origGet(id);
      if (a && ++polls === 2) {
        ledger.approvals.set(to, { amount: '60000000', expiresAt: ledger.nowSeconds + 600 });
        a.status = 'approved';
      }
      return a;
    };
    const paid = await agent.waitForApproval('ap_1');
    expect(paid).toMatchObject({ status: 'paid', amount: '60000000', to });
    expect(ledger.approvals.has(to)).toBe(false); // consumed
  });

  test('rejected approval throws HaloraApprovalError', async () => {
    const { agent, approvals } = setup();
    await agent.pay({ to, amount: 60_000_000n });
    approvals.get('ap_1')!.status = 'rejected';
    await expect(agent.waitForApproval('ap_1')).rejects.toBeInstanceOf(HaloraApprovalError);
  });

  test('approved in API but missing on-chain approval does not pay', async () => {
    const { agent, approvals, ledger } = setup();
    await agent.pay({ to, amount: 60_000_000n });
    approvals.get('ap_1')!.status = 'approved';
    await expect(agent.waitForApproval('ap_1')).rejects.toBeInstanceOf(HaloraApprovalError);
    expect(ledger.submitted.length).toBe(0);
  });

  test('times out', async () => {
    const { agent } = setup();
    await agent.pay({ to, amount: 60_000_000n });
    await expect(agent.waitForApproval('ap_1', { timeoutMs: 0 })).rejects.toThrow(/timed out/);
  });
});
