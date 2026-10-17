import { Address, scValToNative } from '@stellar/stellar-sdk';
import type { PaymentRecord, StoredAccount } from '../domain';
import type { Repositories } from '../repositories/types';
import type { ChainEvent, ChainReader } from '../stellar/chain';
import type { Logger } from '../utils/logger';

export type PaymentIndexerOptions = {
  network: 'testnet' | 'mainnet';
  /** How far back to start for an account with no cursor yet (default about one day). */
  lookbackLedgers?: number;
  pageLimit?: number;
  /** Maximum pages fetched per account per tick, so one busy account cannot starve the rest. */
  maxPagesPerTick?: number;
};

/**
 * Decodes a token `transfer` event into a PaymentRecord for `account`.
 *
 * Accepted layouts (interfaces.md section 1, payments are observed through the token):
 * - Stellar Asset Contract: topics `("transfer", from, to, asset_string)`
 * - plain SEP-41 token:     topics `("transfer", from, to)`
 * Data is the `i128` amount, or a map with an `amount` field when the recipient is muxed
 * (CAP-67 layout). Returns null for anything that does not match exactly, including transfers
 * whose `from` is not the account or whose emitting contract is not the account's token.
 */
export function decodeTransferEvent(
  event: ChainEvent,
  account: Pick<StoredAccount, 'contractId' | 'token'>,
): PaymentRecord | null {
  try {
    if (event.contractId !== account.token) return null;
    const [t0, t1, t2] = event.topic;
    if (!t0 || !t1 || !t2 || event.topic.length < 3 || event.topic.length > 4) return null;
    if (t0.type !== 'scvSymbol' || t0.sym.toString() !== 'transfer') return null;
    if (t1.type !== 'scvAddress' || t2.type !== 'scvAddress') return null;
    const from = Address.fromScAddress(t1.address).toString();
    if (from !== account.contractId) return null;
    const to = Address.fromScAddress(t2.address).toString();

    let amount: bigint | undefined;
    if (event.value.type === 'scvI128') {
      amount = scValToNative(event.value) as bigint;
    } else if (event.value.type === 'scvMap') {
      const native = scValToNative(event.value) as { amount?: unknown };
      if (typeof native.amount === 'bigint') amount = native.amount;
    }
    if (amount === undefined || amount <= 0n) return null;

    return {
      id: event.id,
      contractId: account.contractId,
      token: account.token,
      to,
      amount: amount.toString(),
      txHash: event.txHash,
      ledger: event.ledger,
      createdAt: new Date(event.ledgerClosedAt).toISOString(),
      // The chain does not say whether a transfer paid an x402 resource. Attributing `x402`
      // and `resource` needs agent-side reporting, which is not part of v0.
      source: 'direct',
    };
  } catch {
    return null;
  }
}

/**
 * Polls Stellar RPC `getEvents` for the token `transfer` events sent by each registered
 * account, stores them as PaymentRecords (idempotent on the event id) and keeps one cursor per
 * account. All chain access goes through the injected ChainReader.
 */
export class PaymentIndexer {
  private readonly lookback: number;
  private readonly pageLimit: number;
  private readonly maxPages: number;

  constructor(
    private readonly repos: Repositories,
    private readonly chain: ChainReader,
    private readonly logger: Logger,
    private readonly opts: PaymentIndexerOptions,
  ) {
    this.lookback = opts.lookbackLedgers ?? 17_280;
    this.pageLimit = opts.pageLimit ?? 100;
    this.maxPages = opts.maxPagesPerTick ?? 10;
  }

  /** One polling pass over every registered account. Returns the number of new records. */
  async tick(): Promise<number> {
    const accounts = (await this.repos.accounts.listAll()).filter(
      (a) => a.network === this.opts.network,
    );
    let inserted = 0;
    for (const account of accounts) {
      try {
        inserted += await this.indexAccount(account);
      } catch (err) {
        // One failing account must not stop indexing of the others.
        this.logger.warn('payment indexing failed for account', {
          contractId: account.contractId,
          err,
        });
      }
    }
    return inserted;
  }

  private async indexAccount(account: StoredAccount): Promise<number> {
    const key = `transfers:${account.token}:${account.contractId}`;
    let cursor = (await this.repos.cursors.get(key)) ?? undefined;
    let startLedger: number | undefined;
    if (!cursor) {
      const latest = await this.chain.getLatestLedger();
      startLedger = Math.max(1, latest - this.lookback);
    }

    let inserted = 0;
    for (let page = 0; page < this.maxPages; page++) {
      const res = await this.chain.getTransferEvents({
        token: account.token,
        from: account.contractId,
        cursor,
        startLedger,
        limit: this.pageLimit,
      });
      const records = res.events
        .map((e) => decodeTransferEvent(e, account))
        .filter((r): r is PaymentRecord => r !== null);
      if (records.length > 0) {
        inserted += await this.repos.payments.insertMany(records);
        await this.markSubmitted(records);
      }
      const next = res.cursor ?? res.events.at(-1)?.id;
      if (next && next !== cursor) {
        cursor = next;
        startLedger = undefined;
        await this.repos.cursors.set(key, cursor);
      }
      if (res.events.length < this.pageLimit) break;
    }
    if (inserted > 0) {
      this.logger.info('payments indexed', { contractId: account.contractId, inserted });
    }
    return inserted;
  }

  /**
   * Moves the oldest approved request to the same recipient whose amount covers the payment to
   * `submitted`. This mirrors the contract, which consumes the approval on the next transfer to
   * that recipient with `amount <= approved amount`.
   */
  private async markSubmitted(records: PaymentRecord[]) {
    for (const r of records) {
      const matches = await this.repos.approvals.findApprovedForRecipient(r.contractId, r.to);
      const oldest = matches
        .filter((a) => BigInt(r.amount) <= BigInt(a.amount))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (oldest) {
        await this.repos.approvals.transition(oldest.id, 'approved', { status: 'submitted' });
      }
    }
  }
}
