/* eslint-disable no-console -- a command-line script: console output is its interface */

/**
 * x402 go/no-go (HAL-008): can a Halora custom account pay a real x402 resource on testnet
 * through a public facilitator?
 *
 * Starts a minimal x402 v2 resource server in-process. It answers 402 with Stellar `exact`
 * requirements and, when the request carries a PAYMENT-SIGNATURE, asks the public facilitator
 * to verify and settle it. A HaloraAgent then calls `agent.fetch()` on the resource.
 *
 * Usage (from the repo root):
 *   HALORA_AGENT_SECRET=$(stellar keys show halora-agent) \
 *   HALORA_MERCHANT=$(stellar keys public-key halora-merchant) \
 *   HALORA_CONTRACT_ID=C... \
 *   bun apps/sdk/scripts/x402-e2e.ts
 */

import { HaloraAgent } from '../src/index';
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  decodeBase64Json,
  encodeBase64Json,
} from '../src/x402/index';

const FACILITATOR = process.env.X402_FACILITATOR ?? 'https://x402.org/facilitator';
const XLM_SAC_TESTNET = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const REPORT = new URL('../../../scripts/testnet/x402-last-run.json', import.meta.url).pathname;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing environment variable ${name}`);
  return v.trim();
}

const merchant = env('HALORA_MERCHANT');
const contractId = env('HALORA_CONTRACT_ID');
const report: Record<string, unknown> = {
  network: 'stellar:testnet',
  facilitator: FACILITATOR,
  startedAt: new Date().toISOString(),
};
const log = (step: string, detail: unknown) => {
  report[step] = detail;
  console.log(`[${step}]`, typeof detail === 'string' ? detail : JSON.stringify(detail));
};

function requirements(url: string, amount: string) {
  return {
    scheme: 'exact',
    network: 'stellar:testnet',
    amount,
    asset: XLM_SAC_TESTNET,
    payTo: merchant,
    maxTimeoutSeconds: 60,
    extra: { areFeesSponsored: true },
    resource: url,
  };
}

async function facilitator(path: 'verify' | 'settle', body: unknown) {
  const res = await fetch(`${FACILITATOR}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

// Minimal x402 v2 resource server: one paid route per price.
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const price =
      url.pathname === '/forecast' ? '5000000' : url.pathname === '/report' ? '100000000' : null;
    if (!price) return new Response('not found', { status: 404 });
    const accepted = requirements(url.toString(), price);
    const paymentRequired = {
      x402Version: 2,
      resource: {
        url: url.toString(),
        description: 'Weatherly forecast',
        mimeType: 'application/json',
      },
      accepts: [accepted],
    };
    const signature = req.headers.get(PAYMENT_SIGNATURE_HEADER);
    if (!signature) {
      return new Response('payment required', {
        status: 402,
        headers: { [PAYMENT_REQUIRED_HEADER]: encodeBase64Json(paymentRequired) },
      });
    }
    const paymentPayload = decodeBase64Json(signature);
    const body = { x402Version: 2, paymentPayload, paymentRequirements: accepted };
    const verify = await facilitator('verify', body);
    log('facilitator-verify', verify);
    if (verify.status !== 200 || verify.json.isValid !== true) {
      return new Response('payment rejected', {
        status: 402,
        headers: {
          [PAYMENT_REQUIRED_HEADER]: encodeBase64Json({
            ...paymentRequired,
            error: String(verify.json.invalidReason ?? 'invalid'),
          }),
        },
      });
    }
    const settle = await facilitator('settle', body);
    log('facilitator-settle', settle);
    if (settle.status !== 200 || settle.json.success !== true) {
      return new Response('settlement failed', { status: 402 });
    }
    return Response.json(
      { city: 'Lisbon', tomorrow: { high: 22, low: 15, sky: 'clear' } },
      { headers: { [PAYMENT_RESPONSE_HEADER]: encodeBase64Json(settle.json) } },
    );
  },
});

async function main() {
  const base = `http://localhost:${server.port}`;
  const agent = new HaloraAgent({
    contractId,
    agentSecret: env('HALORA_AGENT_SECRET'),
    network: 'testnet',
    onX402Payment: (e) => log('agent-x402-event', e),
  });

  log('spent-before', `${Number(await agent.views.getSpentToday(contractId)) / 1e7} XLM`);
  const res = await agent.fetch(`${base}/forecast`);
  log('paid-fetch', {
    status: res.status,
    body: res.status === 200 ? await res.json() : await res.text(),
  });
  log('spent-after', `${Number(await agent.views.getSpentToday(contractId)) / 1e7} XLM`);

  // 10 XLM is above the 5 XLM per payment limit: the agent must refuse to sign.
  try {
    const over = await agent.fetch(`${base}/report`);
    log('over-limit-fetch', { refused: false, status: over.status });
    process.exitCode = 1;
  } catch (err) {
    log('over-limit-fetch', { refused: true, code: (err as { code?: string }).code });
  }

  report.finishedAt = new Date().toISOString();
  await Bun.write(REPORT, JSON.stringify(report, null, 2) + '\n');
}

main()
  .catch((err) => {
    console.error('[failed]', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => server.stop(true));
