import { beforeEach, describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { toBaseUnits } from '@/lib/money';
import type { OwnerSession } from '../types';
import { MockWallet } from '../wallet/mock-wallet';
import { MockDataService } from './mock-service';

const NOW = Date.parse('2026-10-16T15:00:00Z');

async function setup() {
  const wallet = new MockWallet(0);
  const publicKey = await wallet.connect();
  const owner: OwnerSession = { publicKey, wallet, network: 'testnet' };
  const service = new MockDataService({ latencyMs: 0, now: () => NOW });
  return { owner, service };
}

describe('MockDataService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    ctx = await setup();
  });

  test('lists seeded agents for the connected owner with spent-today for the current UTC day', async () => {
    const agents = await ctx.service.listAgents(ctx.owner);
    expect(agents).toHaveLength(3);
    for (const a of agents) {
      expect(a.account.ownerPublicKey).toBe(ctx.owner.publicKey);
      expect(BigInt(a.spentToday)).toBeGreaterThanOrEqual(0n);
    }
    expect(agents.find((a) => a.account.label === 'Infra cost monitor')?.policy.paused).toBe(true);
  });

  test('creates an agent, returns an API key once, and validates the policy', async () => {
    const policy = { ...(await ctx.service.listAgents(ctx.owner))[0]!.policy };
    const agentKey = Keypair.random().publicKey();
    const { account, apiKey } = await ctx.service.createAgent(ctx.owner, {
      label: 'Tester',
      agentPublicKey: agentKey,
      policy,
    });
    expect(apiKey).toStartWith('hal_test_');
    expect((await ctx.service.getAgent(ctx.owner, account.contractId))?.account.label).toBe(
      'Tester',
    );

    await expect(
      ctx.service.createAgent(ctx.owner, {
        label: 'Bad',
        agentPublicKey: agentKey,
        policy: { ...policy, dailyLimit: '1' },
      }),
    ).rejects.toThrow('daily limit');
    await expect(
      ctx.service.createAgent(ctx.owner, {
        label: 'Same',
        agentPublicKey: ctx.owner.publicKey,
        policy,
      }),
    ).rejects.toThrow('different from the owner');
  });

  test('approving a request writes a one-time on-chain approval and cannot be repeated', async () => {
    const [pending] = await ctx.service.listApprovals(ctx.owner, { status: 'pending' });
    expect(pending).toBeDefined();
    const approved = await ctx.service.approve(ctx.owner, pending!.id);
    expect(approved.status).toBe('approved');
    expect(approved.approvalTxHash).toMatch(/^[0-9a-f]{64}$/);

    const active = await ctx.service.listPreApprovals(ctx.owner, pending!.contractId);
    const entry = active.find((a) => a.to === pending!.to);
    expect(entry?.amount).toBe(pending!.amount);
    expect(entry?.expiresAt).toBe(NOW / 1000 + 15 * 60);

    await expect(ctx.service.approve(ctx.owner, pending!.id)).rejects.toThrow('already approved');
    await expect(ctx.service.reject(ctx.owner, pending!.id)).rejects.toThrow('already approved');
  });

  test('pre-approves and revokes a recipient', async () => {
    const [agent] = await ctx.service.listAgents(ctx.owner);
    const to = Keypair.random().publicKey();
    await ctx.service.preApprove(ctx.owner, agent!.account.contractId, {
      to,
      amount: toBaseUnits('3'),
      expiresAt: NOW / 1000 + 3600,
    });
    expect(
      (await ctx.service.listPreApprovals(ctx.owner, agent!.account.contractId)).map((a) => a.to),
    ).toContain(to);
    await ctx.service.revokePreApproval(ctx.owner, agent!.account.contractId, to);
    expect(
      (await ctx.service.listPreApprovals(ctx.owner, agent!.account.contractId)).map((a) => a.to),
    ).not.toContain(to);

    await expect(
      ctx.service.preApprove(ctx.owner, agent!.account.contractId, {
        to,
        amount: '1',
        expiresAt: NOW / 1000 - 1,
      }),
    ).rejects.toThrow('future');
  });

  test('pausing updates the policy; other owners are refused', async () => {
    const [agent] = await ctx.service.listAgents(ctx.owner);
    const policy = await ctx.service.setPaused(ctx.owner, agent!.account.contractId, true);
    expect(policy.paused).toBe(true);

    const stranger = new MockWallet(0);
    const strangerSession: OwnerSession = {
      publicKey: await stranger.connect(),
      wallet: stranger,
      network: 'testnet',
    };
    await expect(
      ctx.service.setPaused(strangerSession, agent!.account.contractId, false),
    ).rejects.toThrow('not the owner');
  });

  test('filters payments by agent, newest first', async () => {
    const [agent] = await ctx.service.listAgents(ctx.owner);
    const payments = await ctx.service.listPayments(ctx.owner, {
      contractId: agent!.account.contractId,
    });
    expect(payments.length).toBeGreaterThan(0);
    expect(payments.every((p) => p.contractId === agent!.account.contractId)).toBe(true);
    const times = payments.map((p) => p.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
