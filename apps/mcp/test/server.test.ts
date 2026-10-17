import { describe, expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  PolicyRefusal,
  type ApprovalInfo,
  type FetchOutcome,
  type PayOutcome,
  type PaymentRecordView,
  type WalletBackend,
  type WalletStatus,
} from '../src/backend';
import { loadConfig } from '../src/config';
import { createServer } from '../src/server';

// Test-only values, generated for these tests; not real keys.
const SECRET = `S${'B'.repeat(55)}`;
const API_KEY = 'hak_0123456789abcdef01_testtesttesttesttesttest';
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const RECIPIENT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';

class MockBackend implements WalletBackend {
  calls: Array<{ method: string; args: unknown }> = [];
  payImpl: (i: { to: string; amount: bigint; reason: string }) => Promise<PayOutcome> = async (
    i,
  ) => ({
    status: 'paid',
    txHash: 'f'.repeat(64),
    amount: i.amount.toString(),
    to: i.to,
  });

  async status(): Promise<WalletStatus> {
    this.calls.push({ method: 'status', args: null });
    return {
      contractId: CONTRACT,
      network: 'testnet',
      balance: '500000000',
      spentToday: '30000000',
      policy: {
        token: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
        perTxLimit: '10000000',
        dailyLimit: '50000000',
        approvalThreshold: '5000000',
        allowlistEnabled: false,
        allowlist: [],
        expiresAt: 0,
        paused: false,
      },
    };
  }
  async pay(input: { to: string; amount: bigint; reason: string }) {
    this.calls.push({ method: 'pay', args: input });
    return this.payImpl(input);
  }
  async fetchPaid(input: { url: string; method: string; body?: string }): Promise<FetchOutcome> {
    this.calls.push({ method: 'fetchPaid', args: input });
    return {
      status: 200,
      contentType: 'application/json',
      body: 'x'.repeat(150_000),
      payment: { amount: '1000', to: RECIPIENT, asset: 'USDC', network: 'stellar:testnet' },
    };
  }
  async approvalStatus(id: string): Promise<ApprovalInfo> {
    this.calls.push({ method: 'approvalStatus', args: id });
    return {
      id,
      status: 'approved',
      to: RECIPIENT,
      amount: '9000000',
      reason: 'dataset',
      expiresAt: '2026-10-16T13:00:00.000Z',
    };
  }
  async recentPayments(limit: number): Promise<PaymentRecordView[]> {
    this.calls.push({ method: 'recentPayments', args: limit });
    return [];
  }
}

async function connect(backend: WalletBackend) {
  const server = createServer(backend, { secrets: [SECRET, API_KEY] });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const text = (r: any): string => r.content.map((c: { text: string }) => c.text).join('\n');

describe('halora MCP server', () => {
  test('exposes exactly the five documented tools with limit-aware descriptions', async () => {
    const client = await connect(new MockBackend());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'halora_approval_status',
      'halora_fetch_paid',
      'halora_pay',
      'halora_recent_payments',
      'halora_status',
    ]);
    for (const name of ['halora_pay', 'halora_fetch_paid', 'halora_status']) {
      const tool = tools.find((t) => t.name === name)!;
      expect(tool.description).toContain('policy decision');
      expect(tool.description).toContain('enforced on-chain by the account contract');
    }
    const pay = tools.find((t) => t.name === 'halora_pay')!;
    expect(pay.inputSchema.required?.sort()).toEqual(['amount', 'reason', 'to']);
    expect(pay.annotations?.destructiveHint).toBe(true);
  });

  test('halora_status reports remaining daily budget', async () => {
    const client = await connect(new MockBackend());
    const r = await client.callTool({ name: 'halora_status', arguments: {} });
    const body = JSON.parse(text(r));
    expect(body.remainingToday).toBe('20000000');
    expect(body.policy.perTxLimit).toBe('10000000');
  });

  test('halora_pay passes a bigint amount and returns the result', async () => {
    const backend = new MockBackend();
    const client = await connect(backend);
    const r = await client.callTool({
      name: 'halora_pay',
      arguments: { to: RECIPIENT, amount: '2500000', reason: 'API credits' },
    });
    expect(r.isError).toBeFalsy();
    expect(JSON.parse(text(r))).toMatchObject({ status: 'paid', amount: '2500000' });
    expect(backend.calls[0]).toEqual({
      method: 'pay',
      args: { to: RECIPIENT, amount: 2500000n, reason: 'API credits' },
    });
  });

  test('halora_pay returns approval ids for amounts above the threshold', async () => {
    const backend = new MockBackend();
    backend.payImpl = async (i) => ({
      status: 'approval_pending',
      approvalId: '7f1c3e9a-5b2d-4c8e-9f0a-1b2c3d4e5f60',
      amount: i.amount.toString(),
      to: i.to,
    });
    const client = await connect(backend);
    const r = await client.callTool({
      name: 'halora_pay',
      arguments: { to: RECIPIENT, amount: '9000000', reason: 'dataset' },
    });
    expect(JSON.parse(text(r)).approvalId).toBe('7f1c3e9a-5b2d-4c8e-9f0a-1b2c3d4e5f60');
  });

  test('policy refusals are reported as final policy decisions', async () => {
    const backend = new MockBackend();
    backend.payImpl = async () => {
      throw new PolicyRefusal('PerTxLimitExceeded', 'Amount is above the per-payment limit.');
    };
    const client = await connect(backend);
    const r = await client.callTool({
      name: 'halora_pay',
      arguments: { to: RECIPIENT, amount: '99000000', reason: 'big' },
    });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('Refused by policy (PerTxLimitExceeded)');
    expect(text(r)).toContain('Do not retry');
  });

  test('never leaks the agent secret or API key, even if an error echoes them', async () => {
    const backend = new MockBackend();
    backend.payImpl = async () => {
      throw new Error(`rpc failed for key ${SECRET} with Bearer ${API_KEY}`);
    };
    const client = await connect(backend);
    const r = await client.callTool({
      name: 'halora_pay',
      arguments: { to: RECIPIENT, amount: '1', reason: 'x' },
    });
    expect(r.isError).toBe(true);
    expect(text(r)).not.toContain(SECRET);
    expect(text(r)).not.toContain(API_KEY);
    expect(text(r)).toContain('[redacted]');
  });

  test('rejects invalid input before reaching the wallet', async () => {
    const backend = new MockBackend();
    const client = await connect(backend);
    const r = await client.callTool({
      name: 'halora_pay',
      arguments: { to: RECIPIENT, amount: '-5', reason: 'x' },
    });
    expect(r.isError).toBe(true);
    expect(backend.calls).toHaveLength(0);
  });

  test('halora_fetch_paid truncates large bodies and reports the payment', async () => {
    const backend = new MockBackend();
    const client = await connect(backend);
    const r = await client.callTool({
      name: 'halora_fetch_paid',
      arguments: { url: 'https://data.example.com/report' },
    });
    const body = JSON.parse(text(r));
    expect(body.truncated).toBe(true);
    expect(body.body.length).toBe(100_000);
    expect(body.payment.amount).toBe('1000');
    expect(backend.calls[0]).toEqual({
      method: 'fetchPaid',
      args: { url: 'https://data.example.com/report', method: 'GET', body: undefined },
    });

    const ftp = await client.callTool({
      name: 'halora_fetch_paid',
      arguments: { url: 'file:///etc/passwd' },
    });
    expect(ftp.isError).toBe(true);
  });

  test('approval status and recent payments', async () => {
    const backend = new MockBackend();
    const client = await connect(backend);
    const id = '7f1c3e9a-5b2d-4c8e-9f0a-1b2c3d4e5f60';
    const a = await client.callTool({ name: 'halora_approval_status', arguments: { id } });
    expect(JSON.parse(text(a)).status).toBe('approved');
    const p = await client.callTool({ name: 'halora_recent_payments', arguments: {} });
    expect(JSON.parse(text(p))).toEqual({ payments: [] });
    expect(backend.calls.at(-1)).toEqual({ method: 'recentPayments', args: 20 });
  });
});

describe('config', () => {
  test('loads valid config and requires API url and key together', () => {
    const base = { HALORA_CONTRACT_ID: CONTRACT, HALORA_AGENT_SECRET: SECRET };
    expect(loadConfig(base)).toMatchObject({ network: 'testnet', contractId: CONTRACT });
    expect(() => loadConfig({ ...base, HALORA_API_URL: 'https://api.example.com' })).toThrow(
      'must be set together',
    );
  });

  test('error messages never include the secret value', () => {
    const bad = 'SNOTAVALIDSEED';
    try {
      loadConfig({ HALORA_CONTRACT_ID: CONTRACT, HALORA_AGENT_SECRET: bad });
      throw new Error('expected failure');
    } catch (err) {
      expect((err as Error).message).toContain('HALORA_AGENT_SECRET');
      expect((err as Error).message).not.toContain(bad);
    }
  });
});
