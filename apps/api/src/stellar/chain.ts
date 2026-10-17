import {
  Account,
  Address,
  Contract,
  StrKey,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

/**
 * Read-only access to the chain. Injected into services and workers so tests never touch the
 * network. The production implementation talks to Stellar RPC. The API never signs or submits.
 */

export type AccountInfo = { owner: string; agent: string; token: string };

/** On-chain pre-approval as returned by the account's `approval(to)` view. */
export type OnChainApproval = { amount: bigint; expiresAt: number };

export type ChainEvent = {
  id: string;
  contractId: string;
  topic: xdr.ScVal[];
  value: xdr.ScVal;
  txHash: string;
  ledger: number;
  ledgerClosedAt: string;
};

export type EventsPage = { events: ChainEvent[]; cursor?: string; latestLedger: number };

export type GetTransferEventsInput = {
  /** Token contract (C...) whose `transfer` events are read. */
  token: string;
  /** Only transfers whose `from` topic is this address. */
  from: string;
  /** Resume after this cursor. When absent, `startLedger` is used. */
  cursor?: string;
  startLedger?: number;
  limit: number;
};

export interface ChainReader {
  /** Reads `owner()`, `agent()` and `policy().token` from a halora-account instance. */
  getAccountInfo(contractId: string): Promise<AccountInfo>;
  /** Reads `approval(to)`; null when there is no approval for that recipient. */
  getApproval(contractId: string, to: string): Promise<OnChainApproval | null>;
  getLatestLedger(): Promise<number>;
  /** Token `transfer` events sent from `from` (SEP-41 and Stellar Asset Contract layouts). */
  getTransferEvents(input: GetTransferEventsInput): Promise<EventsPage>;
}

// Well-known all-zero account, used only as the source of read-only simulations.
const NULL_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export class RpcChainReader implements ChainReader {
  private readonly server: rpc.Server;

  constructor(
    rpcUrl: string,
    private readonly networkPassphrase: string,
  ) {
    this.server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://localhost') });
  }

  private async view(contractId: string, method: string, ...args: xdr.ScVal[]) {
    const tx = new TransactionBuilder(new Account(NULL_ACCOUNT, '0'), {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim) || !sim.result) {
      throw new Error(`Simulation of ${method}() failed`);
    }
    return sim.result.retval;
  }

  async getAccountInfo(contractId: string): Promise<AccountInfo> {
    const [owner, agent, policy] = await Promise.all([
      this.view(contractId, 'owner'),
      this.view(contractId, 'agent'),
      this.view(contractId, 'policy'),
    ]);
    const policyNative = scValToNative(policy) as { token?: unknown };
    if (typeof policyNative.token !== 'string') throw new Error('policy().token missing');
    return {
      owner: StrKey.encodeEd25519PublicKey(Buffer.from(scValToNative(owner) as Uint8Array)),
      agent: StrKey.encodeEd25519PublicKey(Buffer.from(scValToNative(agent) as Uint8Array)),
      token: policyNative.token,
    };
  }

  async getApproval(contractId: string, to: string): Promise<OnChainApproval | null> {
    const ret = await this.view(contractId, 'approval', new Address(to).toScVal());
    return decodeApproval(ret);
  }

  async getLatestLedger(): Promise<number> {
    return (await this.server.getLatestLedger()).sequence;
  }

  async getTransferEvents(input: GetTransferEventsInput): Promise<EventsPage> {
    const transfer = xdr.ScVal.scvSymbol('transfer').toXdr('base64');
    const from = new Address(input.from).toScVal().toXdr('base64');
    const filters: rpc.Api.EventFilter[] = [
      {
        type: 'contract',
        contractIds: [input.token],
        // SAC layout: (transfer, from, to, asset). Plain SEP-41 layout: (transfer, from, to).
        topics: [
          [transfer, from, '*', '*'],
          [transfer, from, '*'],
        ],
      },
    ];
    const req: rpc.Server.GetEventsRequest = input.cursor
      ? { filters, cursor: input.cursor, limit: input.limit }
      : { filters, startLedger: input.startLedger ?? 1, limit: input.limit };
    const res = await this.server.getEvents(req);
    return {
      cursor: res.cursor,
      latestLedger: res.latestLedger,
      events: res.events.map((e) => ({
        id: e.id,
        contractId: e.contractId ? e.contractId.contractId() : '',
        topic: e.topic,
        value: e.value,
        txHash: e.txHash,
        ledger: e.ledger,
        ledgerClosedAt: e.ledgerClosedAt,
      })),
    };
  }
}

/** Decodes `Option<Approval { amount: i128, expires_at: u64 }>`. */
export function decodeApproval(val: xdr.ScVal): OnChainApproval | null {
  if (val.type === 'scvVoid') return null;
  const native = scValToNative(val) as { amount?: unknown; expires_at?: unknown } | null;
  if (!native || typeof native.amount !== 'bigint') {
    throw new Error('Unexpected approval() return value');
  }
  const expiresAt = Number(native.expires_at);
  if (!Number.isSafeInteger(expiresAt)) throw new Error('Unexpected approval() expires_at');
  return { amount: native.amount, expiresAt };
}
