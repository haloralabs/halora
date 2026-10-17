import { describe, expect, test } from 'bun:test';
import { Address, Keypair, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import type { ChainEvent } from '../src/stellar/chain';
import { silentLogger } from '../src/utils/logger';
import { PaymentIndexer, decodeTransferEvent } from '../src/workers/payment-indexer';
import { login, makeHarness, randomContractId, registerAccount } from './helpers';

function transferEvent(opts: {
  id: string;
  token: string;
  from: string;
  to: string;
  amount: bigint;
  sac?: boolean;
  muxedMap?: boolean;
  ledger?: number;
}): ChainEvent {
  const topic = [
    xdr.ScVal.scvSymbol('transfer'),
    new Address(opts.from).toScVal(),
    new Address(opts.to).toScVal(),
  ];
  if (opts.sac !== false)
    topic.push(nativeToScVal('USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'));
  const amount = nativeToScVal(opts.amount, { type: 'i128' });
  const value = opts.muxedMap
    ? xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('amount'), val: amount }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('to_muxed_id'),
          val: nativeToScVal(7, { type: 'u64' }),
        }),
      ])
    : amount;
  return {
    id: opts.id,
    contractId: opts.token,
    topic,
    value,
    txHash: 'c'.repeat(64),
    ledger: opts.ledger ?? 500,
    ledgerClosedAt: '2026-10-16T11:59:00Z',
  };
}

describe('decodeTransferEvent', () => {
  const account = { contractId: randomContractId(), token: randomContractId() };
  const to = Keypair.random().publicKey();

  test('decodes SAC, SEP-41 and muxed-map layouts', () => {
    for (const variant of [{}, { sac: false }, { muxedMap: true }]) {
      const rec = decodeTransferEvent(
        transferEvent({
          id: 'e',
          token: account.token,
          from: account.contractId,
          to,
          amount: 42n,
          ...variant,
        }),
        account,
      );
      expect(rec).toMatchObject({
        contractId: account.contractId,
        to,
        amount: '42',
        source: 'direct',
      });
    }
  });

  test('ignores transfers not sent by the account or from another token', () => {
    const otherFrom = transferEvent({
      id: 'e',
      token: account.token,
      from: Keypair.random().publicKey(),
      to,
      amount: 1n,
    });
    expect(decodeTransferEvent(otherFrom, account)).toBeNull();
    const otherToken = transferEvent({
      id: 'e',
      token: randomContractId(),
      from: account.contractId,
      to,
      amount: 1n,
    });
    expect(decodeTransferEvent(otherToken, account)).toBeNull();
    const wrongSymbol = {
      ...otherToken,
      contractId: account.token,
      topic: [xdr.ScVal.scvSymbol('mint')],
    };
    expect(decodeTransferEvent(wrongSymbol, account)).toBeNull();
  });
});

describe('PaymentIndexer', () => {
  test('indexes transfers, keeps a cursor, is idempotent and marks approvals submitted', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const ownerToken = await login(h, owner);
    const acct = await registerAccount(h, owner, ownerToken);
    const recipient = Keypair.random().publicKey();

    // An approved request that the next transfer to `recipient` consumes.
    const created = await h.call('POST', '/v1/approvals', {
      token: acct.apiKey,
      body: {
        contractId: acct.contractId,
        token: acct.token,
        to: recipient,
        amount: '300',
        reason: 'large purchase',
      },
    });
    h.chain.approvals.set(`${acct.contractId}:${recipient}`, {
      amount: 300n,
      expiresAt: Math.floor(h.clock.now.getTime() / 1000) + 600,
    });
    await h.call('POST', `/v1/approvals/${created.json.id}/approve`, {
      token: ownerToken,
      body: { approvalTxHash: 'd'.repeat(64) },
    });

    const e1 = transferEvent({
      id: 'evt-1',
      token: acct.token,
      from: acct.contractId,
      to: recipient,
      amount: 300n,
      ledger: 501,
    });
    const e2 = transferEvent({
      id: 'evt-2',
      token: acct.token,
      from: acct.contractId,
      to: recipient,
      amount: 5n,
      ledger: 502,
    });
    h.chain.pages = [{ events: [e1, e2], cursor: 'cursor-2', latestLedger: 600 }];

    const indexer = new PaymentIndexer(h.repos, h.chain, silentLogger, {
      network: 'testnet',
      lookbackLedgers: 1000,
    });
    expect(await indexer.tick()).toBe(2);
    expect(h.chain.calls[0]).toMatchObject({
      token: acct.token,
      from: acct.contractId,
      startLedger: 99_000,
      cursor: undefined,
    });

    const payments = await h.call('GET', `/v1/accounts/${acct.contractId}/payments`, {
      token: ownerToken,
    });
    expect(payments.json.payments.map((p: { id: string }) => p.id)).toEqual(['evt-2', 'evt-1']);
    expect(payments.json.payments[0]).not.toHaveProperty('spentToday');

    expect((await h.repos.approvals.findById(created.json.id))?.status).toBe('submitted');

    // Next tick resumes from the stored cursor; replaying the same events inserts nothing.
    h.chain.pages = [{ events: [e1], cursor: 'cursor-3', latestLedger: 601 }];
    expect(await indexer.tick()).toBe(0);
    expect(h.chain.calls[1]).toMatchObject({ cursor: 'cursor-2', startLedger: undefined });
  });

  test('a failing account does not stop the others', async () => {
    const h = makeHarness();
    const owner = Keypair.random();
    const token = await login(h, owner);
    await registerAccount(h, owner, token);
    await registerAccount(h, owner, token);
    let n = 0;
    h.chain.getTransferEvents = async () => {
      n++;
      if (n === 1) throw new Error('rpc timeout');
      return { events: [], latestLedger: 1 };
    };
    const indexer = new PaymentIndexer(h.repos, h.chain, silentLogger, { network: 'testnet' });
    expect(await indexer.tick()).toBe(0);
    expect(n).toBe(2);
  });
});
