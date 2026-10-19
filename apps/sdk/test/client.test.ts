import { describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { HaloraClient, computeContractId } from '../src/client.js';
import { HaloraSdkError } from '../src/errors.js';
import { CONTRACT_ID, FakeLedger, PASSPHRASE } from './fake-ledger.js';

function setup() {
  const owner = Keypair.random();
  const agent = Keypair.random();
  const ledger = new FakeLedger(owner, agent);
  const client = new HaloraClient({
    network: 'testnet',
    rpc: ledger,
    wasmHash: 'ab'.repeat(32),
    pollIntervalMs: 1,
  });
  return { owner, agent, ledger, client };
}

describe('HaloraClient views', () => {
  test('reads policy, spent today, keys, approval and balance', async () => {
    const { client, ledger, owner, agent } = setup();
    ledger.spentToday = 123n;
    expect(await client.getPolicy(CONTRACT_ID)).toEqual(ledger.policy);
    expect(await client.getSpentToday(CONTRACT_ID)).toBe(123n);
    expect(await client.getOwner(CONTRACT_ID)).toBe(owner.publicKey());
    expect(await client.getAgent(CONTRACT_ID)).toBe(agent.publicKey());
    expect(await client.getBalance(CONTRACT_ID)).toBe(1_000_000_000n);
    const to = Keypair.random().publicKey();
    expect(await client.getApproval(CONTRACT_ID, to)).toBeNull();
    ledger.approvals.set(to, { amount: '5', expiresAt: 2_000_000_000 });
    expect(await client.getApproval(CONTRACT_ID, to)).toEqual({
      amount: '5',
      expiresAt: 2_000_000_000,
    });
  });

  test('validates contract IDs', async () => {
    const { client } = setup();
    await expect(client.getPolicy('GABC')).rejects.toThrow();
  });

  test('mainnet without rpcUrl fails closed', () => {
    expect(() => new HaloraClient({ network: 'mainnet' })).toThrow(/rpcUrl/);
  });
});

describe('HaloraClient owner operations', () => {
  test('setPolicy signs with the Owner variant and is enforce-simulated', async () => {
    const { client, ledger, owner } = setup();
    const policy = { ...ledger.policy, dailyLimit: '900000000' };
    await client.setPolicy({ contractId: CONTRACT_ID, owner, policy });
    expect(ledger.policy.dailyLimit).toBe('900000000');
    expect(ledger.simulations.map((s) => [s.fn, s.authMode ?? 'record', s.authCount])).toEqual([
      ['set_policy', 'record', 0],
      ['set_policy', 'enforce', 1],
    ]);
    expect(ledger.submitted[0]!.signatures.length).toBe(1);
  });

  test('a non-owner key is rejected by the (modelled) contract', async () => {
    const { client, agent } = setup();
    await expect(client.pause({ contractId: CONTRACT_ID, owner: agent })).rejects.toThrow(
      /signature is invalid/,
    );
  });

  test('approvePayment and revokeApproval', async () => {
    const { client, ledger, owner } = setup();
    const to = Keypair.random().publicKey();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const hash = await client.approvePayment({
      contractId: CONTRACT_ID,
      owner,
      to,
      amount: 70_000_000n,
      expiresAt,
    });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger.approvals.get(to)).toEqual({ amount: '70000000', expiresAt });
    await client.revokeApproval({ contractId: CONTRACT_ID, owner, to });
    expect(ledger.approvals.has(to)).toBe(false);
    await expect(
      client.approvePayment({ contractId: CONTRACT_ID, owner, to, amount: 1n, expiresAt: 1 }),
    ).rejects.toThrow(HaloraSdkError);
  });

  test('deployAccount derives the contract ID and checks the returned address', async () => {
    const { client, ledger, owner, agent } = setup();
    const salt = new Uint8Array(32).fill(9);
    const expected = computeContractId(PASSPHRASE, owner.publicKey(), salt);
    ledger.deployReturn = expected;
    const id = await client.deployAccount({
      owner,
      agentPublicKey: agent.publicKey(),
      policy: ledger.policy,
      salt,
    });
    expect(id).toBe(expected);

    ledger.deployReturn = CONTRACT_ID;
    await expect(
      client.deployAccount({
        owner,
        agentPublicKey: agent.publicKey(),
        policy: ledger.policy,
        salt,
      }),
    ).rejects.toThrow(/does not match/);
  });

  test('deployAccount refuses owner == agent and missing wasm hash', async () => {
    const { ledger, owner } = setup();
    // Mainnet has no halora-account WASM hash until the mainnet deployment (testnet now does).
    const noHash = new HaloraClient({ network: 'mainnet', rpc: ledger });
    await expect(
      noHash.deployAccount({
        owner,
        agentPublicKey: Keypair.random().publicKey(),
        policy: ledger.policy,
      }),
    ).rejects.toThrow(/WASM hash/);
    const client = new HaloraClient({ network: 'testnet', rpc: ledger, wasmHash: 'cd'.repeat(32) });
    await expect(
      client.deployAccount({ owner, agentPublicKey: owner.publicKey(), policy: ledger.policy }),
    ).rejects.toThrow(/differ/);
  });
});
