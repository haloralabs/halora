import { randomBytes } from 'node:crypto';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { createApp, type AppConfig } from '../src/app';
import { createMemoryRepositories } from '../src/repositories/memory';
import type { Repositories } from '../src/repositories/types';
import type {
  AccountInfo,
  ChainReader,
  EventsPage,
  GetTransferEventsInput,
  OnChainApproval,
} from '../src/stellar/chain';
import { silentLogger } from '../src/utils/logger';

export const randomContractId = () => StrKey.encodeContract(randomBytes(32));

/** In-memory ChainReader. No network access. */
export class FakeChain implements ChainReader {
  accounts = new Map<string, AccountInfo>();
  approvals = new Map<string, OnChainApproval>();
  pages: EventsPage[] = [];
  calls: GetTransferEventsInput[] = [];
  latestLedger = 100_000;
  fail = false;

  async getAccountInfo(contractId: string) {
    if (this.fail) throw new Error('rpc down');
    const info = this.accounts.get(contractId);
    if (!info) throw new Error('not a halora account');
    return info;
  }
  async getApproval(contractId: string, to: string) {
    if (this.fail) throw new Error('rpc down');
    return this.approvals.get(`${contractId}:${to}`) ?? null;
  }
  async getLatestLedger() {
    return this.latestLedger;
  }
  async getTransferEvents(input: GetTransferEventsInput) {
    this.calls.push(input);
    return (
      this.pages.shift() ?? { events: [], latestLedger: this.latestLedger, cursor: input.cursor }
    );
  }
}

export const testConfig: AppConfig = {
  network: 'testnet',
  authDomain: 'api.test',
  corsOrigins: ['http://localhost:3000'],
  sessionTtlSeconds: 3600,
  challengeTtlSeconds: 300,
  approvalDefaultTtlSeconds: 3600,
  rateLimitPerMinute: 1000,
  trustProxy: false,
};

export type Harness = {
  app: ReturnType<typeof createApp>;
  repos: Repositories;
  chain: FakeChain;
  clock: { now: Date };
  call: (
    method: string,
    path: string,
    opts?: { body?: unknown; token?: string },
  ) => Promise<{ status: number; json: any }>;
};

export function makeHarness(config: Partial<AppConfig> = {}): Harness {
  const repos = createMemoryRepositories();
  const chain = new FakeChain();
  const clock = { now: new Date('2026-10-16T12:00:00Z') };
  const app = createApp({
    config: { ...testConfig, ...config },
    repos,
    chain,
    logger: silentLogger,
    now: () => clock.now,
  });
  const call: Harness['call'] = async (method, path, opts = {}) => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
    );
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };
  return { app, repos, chain, clock, call };
}

export async function login(h: Harness, kp: Keypair): Promise<string> {
  const ch = await h.call('POST', '/v1/auth/challenge', { body: { publicKey: kp.publicKey() } });
  const signature = Buffer.from(kp.sign(Buffer.from(ch.json.message, 'utf8'))).toString('base64');
  const v = await h.call('POST', '/v1/auth/verify', {
    body: { publicKey: kp.publicKey(), nonce: ch.json.nonce, signature },
  });
  if (v.status !== 200) throw new Error(`login failed: ${JSON.stringify(v.json)}`);
  return v.json.token;
}

/** Registers a fresh account owned by `owner`, returning its ids and the agent API key. */
export async function registerAccount(h: Harness, owner: Keypair, ownerToken: string) {
  const contractId = randomContractId();
  const agent = Keypair.random();
  const token = randomContractId();
  h.chain.accounts.set(contractId, { owner: owner.publicKey(), agent: agent.publicKey(), token });
  const res = await h.call('POST', '/v1/accounts', {
    token: ownerToken,
    body: { contractId, label: 'research agent' },
  });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.json)}`);
  return { contractId, agent, token, apiKey: res.json.apiKey as string };
}
