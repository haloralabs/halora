import { describe, expect, test } from 'bun:test';
import contractsTestnet from './contracts.testnet.json' with { type: 'json' };
import { CONTRACTS, requireContract } from './contracts.js';
import {
  AgentAccountSchema,
  ApprovalRequestSchema,
  CreateApprovalBodySchema,
  PaymentRecordSchema,
  PaymentResultSchema,
  PolicySchema,
} from './schemas.js';

const TOKEN = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const G = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const HASH = 'a'.repeat(64);
const NOW = '2026-10-16T12:00:00.000Z';

const policy = {
  token: TOKEN,
  perTxLimit: '10000000',
  dailyLimit: '50000000',
  approvalThreshold: '5000000',
  allowlistEnabled: true,
  allowlist: [G, TOKEN],
  expiresAt: 0,
  paused: false,
};

describe('PolicySchema', () => {
  test('accepts a valid policy', () => {
    expect(PolicySchema.parse(policy)).toEqual(policy);
  });

  test('rejects numeric amounts, bad addresses and negative expiry', () => {
    expect(PolicySchema.safeParse({ ...policy, perTxLimit: 10 }).success).toBe(false);
    expect(PolicySchema.safeParse({ ...policy, dailyLimit: '-1' }).success).toBe(false);
    expect(PolicySchema.safeParse({ ...policy, token: G }).success).toBe(false);
    expect(PolicySchema.safeParse({ ...policy, allowlist: ['GABC'] }).success).toBe(false);
    expect(PolicySchema.safeParse({ ...policy, expiresAt: -1 }).success).toBe(false);
    expect(PolicySchema.safeParse({ ...policy, expiresAt: 1.5 }).success).toBe(false);
    expect(
      PolicySchema.safeParse({ ...policy, allowlist: Array.from({ length: 51 }, () => G) }).success,
    ).toBe(false);
  });
});

describe('record schemas', () => {
  test('AgentAccount', () => {
    const ok = AgentAccountSchema.safeParse({
      contractId: TOKEN,
      ownerPublicKey: G,
      agentPublicKey: G,
      label: 'research agent',
      network: 'testnet',
      createdAt: NOW,
    });
    expect(ok.success).toBe(true);
    expect(AgentAccountSchema.safeParse({ ...ok.data, network: 'futurenet' }).success).toBe(false);
  });

  test('PaymentRecord and PaymentResult', () => {
    const record = {
      id: 'p1',
      contractId: TOKEN,
      token: TOKEN,
      to: G,
      amount: '1',
      txHash: HASH,
      ledger: 10,
      createdAt: NOW,
      source: 'x402',
      resource: 'https://api.example.com/data',
    };
    expect(PaymentRecordSchema.safeParse(record).success).toBe(true);
    expect(PaymentRecordSchema.safeParse({ ...record, source: 'card' }).success).toBe(false);
    expect(
      PaymentResultSchema.safeParse({
        status: 'paid',
        contractId: TOKEN,
        token: TOKEN,
        to: G,
        amount: '1',
        txHash: HASH,
        ledger: 1,
      }).success,
    ).toBe(true);
  });

  test('ApprovalRequest and create body', () => {
    const approval = {
      id: 'a1',
      contractId: TOKEN,
      token: TOKEN,
      to: G,
      amount: '60000000',
      reason: 'buy dataset',
      status: 'pending',
      createdAt: NOW,
      expiresAt: NOW,
    };
    expect(ApprovalRequestSchema.safeParse(approval).success).toBe(true);
    expect(ApprovalRequestSchema.safeParse({ ...approval, amount: '0' }).success).toBe(false);
    expect(ApprovalRequestSchema.safeParse({ ...approval, approvalTxHash: HASH }).success).toBe(
      true,
    );
    expect(ApprovalRequestSchema.safeParse({ ...approval, approvalTxHash: 'abc' }).success).toBe(
      false,
    );
    expect(ApprovalRequestSchema.safeParse({ ...approval, status: 'done' }).success).toBe(false);
    const { id: _id, status: _s, createdAt: _c, expiresAt: _e, ...body } = approval;
    expect(CreateApprovalBodySchema.safeParse(body).success).toBe(true);
  });
});

describe('contracts json', () => {
  test('has the documented shape with placeholders', () => {
    expect(Object.keys(contractsTestnet).sort()).toEqual(['haloraAccountWasmHash', 'usdc']);
    expect(Object.keys(CONTRACTS.mainnet).sort()).toEqual(['haloraAccountWasmHash', 'usdc']);
  });

  test('requireContract fails closed on empty placeholders', () => {
    if (!CONTRACTS.testnet.haloraAccountWasmHash) {
      expect(() => requireContract('testnet', 'haloraAccountWasmHash')).toThrow(/not configured/);
    }
    if (!CONTRACTS.mainnet.usdc) {
      expect(() => requireContract('mainnet', 'usdc')).toThrow(/not configured/);
    }
  });
});
