import { describe, expect, test } from 'bun:test';
import {
  Address,
  Keypair,
  TransactionBuilder,
  scValToNative,
  type Transaction,
} from '@stellar/stellar-sdk';
import { HaloraAgent } from '../src/agent.js';
import type { FetchLike } from '../src/api.js';
import { getAddressCredentials, getAuthEntryPayload } from '../src/auth.js';
import { decodeHaloraSignature } from '../src/scval.js';
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  createX402Fetch,
  decodeBase64Json,
  encodeBase64Json,
  ledgerTimeout,
  parsePaymentResponse,
  selectStellarRequirement,
  type PaymentPayload,
  type PaymentRequirements,
} from '../src/x402/index.js';
import { CONTRACT_ID, FakeLedger, PASSPHRASE, TOKEN_ID } from './fake-ledger.js';

const payTo = Keypair.random().publicKey();
const RESOURCE = 'https://data.example.com/weather';

function requirement(over: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: 'stellar:testnet',
    amount: '1000000',
    asset: TOKEN_ID,
    payTo,
    maxTimeoutSeconds: 60,
    extra: { areFeesSponsored: true },
    ...over,
  };
}

function resourceServer(
  accepts: unknown[],
  seen: { payload?: PaymentPayload; calls: number },
): FetchLike {
  return async (_input, init) => {
    seen.calls++;
    const sig = new Headers(init?.headers).get(PAYMENT_SIGNATURE_HEADER);
    if (!sig) {
      return new Response('{}', {
        status: 402,
        headers: {
          [PAYMENT_REQUIRED_HEADER]: encodeBase64Json({
            x402Version: 2,
            error: 'PAYMENT-SIGNATURE header is required',
            resource: { url: RESOURCE, mimeType: 'application/json' },
            accepts,
          }),
        },
      });
    }
    seen.payload = decodeBase64Json(sig) as PaymentPayload;
    return new Response('{"temp":21}', {
      status: 200,
      headers: {
        [PAYMENT_RESPONSE_HEADER]: encodeBase64Json({
          success: true,
          transaction: 'a'.repeat(64),
          network: 'stellar:testnet',
          payer: CONTRACT_ID,
        }),
      },
    });
  };
}

function agentWith(fetchImpl: FetchLike, ledger: FakeLedger, agentKp: Keypair, extra = {}) {
  return new HaloraAgent({
    contractId: CONTRACT_ID,
    agentSecret: agentKp.secret(),
    network: 'testnet',
    rpc: ledger,
    fetch: fetchImpl,
    now: () => ledger.nowSeconds,
    ...extra,
  });
}

describe('x402 helpers', () => {
  test('base64 JSON codec handles unicode', () => {
    const v = { a: 'café', n: 1 };
    expect(decodeBase64Json(encodeBase64Json(v))).toEqual(v);
  });

  test('ledger timeout per spec', () => {
    expect(ledgerTimeout(60)).toBe(12);
    expect(ledgerTimeout(61)).toBe(13);
    expect(ledgerTimeout(1)).toBe(1);
  });

  test('selection requires exact, our network, policy token and sponsored fees', () => {
    expect(selectStellarRequirement([requirement()], 'testnet', TOKEN_ID)).toBeDefined();
    expect(
      selectStellarRequirement([requirement({ network: 'stellar:pubnet' })], 'testnet', TOKEN_ID),
    ).toBeUndefined();
    expect(
      selectStellarRequirement([requirement({ scheme: 'upto' })], 'testnet', TOKEN_ID),
    ).toBeUndefined();
    expect(
      selectStellarRequirement([requirement({ asset: CONTRACT_ID })], 'testnet', TOKEN_ID),
    ).toBeUndefined();
    expect(
      selectStellarRequirement([requirement({ extra: {} })], 'testnet', TOKEN_ID),
    ).toBeUndefined();
    expect(selectStellarRequirement([requirement()], 'mainnet', TOKEN_ID)).toBeUndefined();
  });

  test('non-402 and non-x402 402 responses pass through without paying', async () => {
    let created = 0;
    const signer = { select: () => requirement(), createPayload: async () => (created++, {}) };
    const ok = createX402Fetch({ fetch: async () => new Response('ok'), signer });
    expect(await (await ok('https://x.test')).text()).toBe('ok');
    const plain402 = createX402Fetch({
      fetch: async () => new Response('', { status: 402 }),
      signer,
    });
    expect((await plain402('https://x.test')).status).toBe(402);
    expect(created).toBe(0);
  });

  test('refuses to replay streaming bodies', async () => {
    const seen = { calls: 0 };
    const f = createX402Fetch({
      fetch: resourceServer([requirement()], seen),
      signer: { select: () => requirement(), createPayload: async () => ({}) },
    });
    const body = new ReadableStream({ start: (c) => c.close() });
    await expect(f('https://x.test', { method: 'POST', body })).rejects.toThrow(/streaming body/);
  });

  test('parsePaymentResponse', () => {
    const res = new Response('', {
      headers: {
        [PAYMENT_RESPONSE_HEADER]: encodeBase64Json({
          success: true,
          transaction: 'ab',
          network: 'n',
        }),
      },
    });
    expect(parsePaymentResponse(res)?.success).toBe(true);
    expect(parsePaymentResponse(new Response(''))).toBeNull();
  });
});

describe('HaloraAgent.fetch (x402 exact on Stellar)', () => {
  test('pays with an Agent-signed auth entry; agent needs no funded account', async () => {
    const owner = Keypair.random();
    const agentKp = Keypair.random();
    const ledger = new FakeLedger(owner, agentKp);
    ledger.unfunded.add(agentKp.publicKey());
    const seen: { payload?: PaymentPayload; calls: number } = { calls: 0 };
    const events: string[] = [];
    const agent = agentWith(
      resourceServer([requirement({ scheme: 'upto' }), requirement()], seen),
      ledger,
      agentKp,
      {
        onX402Payment: (e: { url: string }) => void events.push(e.url),
      },
    );

    const res = await agent.fetch(RESOURCE);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ temp: 21 });
    expect(seen.calls).toBe(2);
    expect(events).toEqual([RESOURCE]);
    expect(ledger.submitted.length).toBe(0); // the facilitator submits, not us

    const p = seen.payload!;
    expect(p.x402Version).toBe(2);
    expect(p.accepted).toEqual(requirement());
    expect(p.resource?.url).toBe(RESOURCE);
    const tx = TransactionBuilder.fromXDR(
      p.payload['transaction'] as string,
      PASSPHRASE,
    ) as Transaction;
    expect(tx.operations.length).toBe(1);
    expect(tx.signatures.length).toBe(0);
    const op = tx.operations[0]!;
    if (op.type !== 'invokeHostFunction' || op.func.type !== 'hostFunctionTypeInvokeContract') {
      throw new Error('expected invokeContract');
    }
    const call = op.func.invokeContract;
    expect(Address.fromScAddress(call.contractAddress).toString()).toBe(TOKEN_ID);
    expect(call.functionName.toString()).toBe('transfer');
    expect(Address.fromScVal(call.args[0]!).toString()).toBe(CONTRACT_ID);
    expect(Address.fromScVal(call.args[1]!).toString()).toBe(payTo);
    expect(scValToNative(call.args[2]!)).toBe(1_000_000n);

    const entry = op.auth![0]!;
    const creds = getAddressCredentials(entry)!;
    expect(creds.signatureExpirationLedger).toBe(ledger.latestLedger + 12);
    const sig = decodeHaloraSignature(creds.signature);
    if (sig.kind !== 'Agent') throw new Error('expected Agent');
    expect(agentKp.verify(getAuthEntryPayload(entry, PASSPHRASE), sig.agent.signature)).toBe(true);
  });

  test('above threshold without pre-approval: ApprovalRequired, no payment header sent', async () => {
    const ledger = new FakeLedger(Keypair.random(), Keypair.random());
    const seen = { calls: 0 };
    const agent = agentWith(
      resourceServer([requirement({ amount: '60000000' })], seen),
      ledger,
      ledger.agent,
    );
    await expect(agent.fetch(RESOURCE)).rejects.toMatchObject({ code: 'ApprovalRequired' });
    expect(seen.calls).toBe(1);
  });

  test('above threshold with a valid on-chain pre-approval pays', async () => {
    const ledger = new FakeLedger(Keypair.random(), Keypair.random());
    ledger.approvals.set(payTo, { amount: '60000000', expiresAt: ledger.nowSeconds + 60 });
    const seen: { payload?: PaymentPayload; calls: number } = { calls: 0 };
    const agent = agentWith(
      resourceServer([requirement({ amount: '60000000' })], seen),
      ledger,
      ledger.agent,
    );
    expect((await agent.fetch(RESOURCE)).status).toBe(200);
  });

  test('maxX402Amount caps payments and unknown assets are refused', async () => {
    const ledger = new FakeLedger(Keypair.random(), Keypair.random());
    const seen = { calls: 0 };
    const capped = agentWith(resourceServer([requirement()], seen), ledger, ledger.agent, {
      maxX402Amount: 10n,
    });
    await expect(capped.fetch(RESOURCE)).rejects.toThrow(/maxX402Amount/);
    const other = agentWith(
      resourceServer([requirement({ asset: CONTRACT_ID })], seen),
      ledger,
      ledger.agent,
    );
    await expect(other.fetch(RESOURCE)).rejects.toThrow(/no acceptable x402 payment option/);
  });

  test('policy denial (paused) stops payment', async () => {
    const ledger = new FakeLedger(Keypair.random(), Keypair.random(), { paused: true });
    const seen = { calls: 0 };
    const agent = agentWith(resourceServer([requirement()], seen), ledger, ledger.agent);
    await expect(agent.fetch(RESOURCE)).rejects.toMatchObject({ code: 'Paused' });
    expect(seen.calls).toBe(1);
  });
});
