/**
 * Testnet end-to-end check for halora-account through @halora/sdk.
 *
 * Proves, against the real network, that:
 *   1. the SDK deploys an account from the uploaded WASM hash,
 *   2. an agent payment within the policy settles,
 *   3. a payment above the approval threshold is held (SDK pre-flight) and settles once the
 *      owner pre-approves it on-chain, consuming the approval,
 *   4. the CONTRACT itself (not the SDK) refuses an over-limit payment and a payment to a
 *      recipient outside the allowlist, when the agent bypasses the SDK pre-flight.
 *
 * The policy token is the native XLM Stellar Asset Contract, so the run needs no faucet beyond
 * friendbot. Secrets come from the environment and are never printed.
 *
 * Usage (from the repo root):
 *   HALORA_OWNER_SECRET=$(stellar keys show halora-owner) \
 *   HALORA_AGENT_SECRET=$(stellar keys show halora-agent) \
 *   HALORA_MERCHANT=$(stellar keys public-key halora-merchant) \
 *   bun apps/sdk/scripts/testnet-e2e.ts
 */

/* eslint-disable no-console -- a command-line script: console output is its interface */

import { Address, Keypair, nativeToScVal, type xdr } from '@stellar/stellar-sdk';
import { HaloraAgent, HaloraClient } from '../src/index';
import { invokeWithHaloraAuth } from '../src/invoke';

const XLM_SAC_TESTNET = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const XLM = 10_000_000n; // 7 decimals
const REPORT = new URL('../../../scripts/testnet/last-run.json', import.meta.url).pathname;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing environment variable ${name}`);
  return v.trim();
}

const owner = Keypair.fromSecret(env('HALORA_OWNER_SECRET'));
const agentSecret = env('HALORA_AGENT_SECRET');
const agentKey = Keypair.fromSecret(agentSecret);
const merchant = env('HALORA_MERCHANT');
const existing = process.env.HALORA_CONTRACT_ID?.trim();

const client = new HaloraClient({ network: 'testnet' });
const report: Record<string, unknown> = { network: 'testnet', startedAt: new Date().toISOString() };
const log = (step: string, detail: unknown) => {
  report[step] = detail;
  console.log(`[${step}]`, typeof detail === 'string' ? detail : JSON.stringify(detail));
};

async function expectContractRejection(
  label: string,
  to: string,
  amount: bigint,
  contractId: string,
) {
  try {
    await invokeWithHaloraAuth({
      ctx: client.txContext,
      contractId,
      callContract: XLM_SAC_TESTNET,
      method: 'transfer',
      args: [
        new Address(contractId).toScVal(),
        new Address(to).toScVal(),
        nativeToScVal(amount, { type: 'i128' }) as xdr.ScVal,
      ],
      role: 'Agent',
      signer: agentKey,
      sourcePublicKey: agentKey.publicKey(),
      feePayer: agentKey,
      validForLedgers: 12,
    });
    log(label, { rejected: false, error: 'the contract accepted a payment it must refuse' });
    process.exitCode = 1;
  } catch (err) {
    // The SDK maps account-contract failures to HaloraPolicyError with the contract's error name.
    const e = err as { name?: string; code?: string; message?: string };
    const onChain = e.name === 'HaloraPolicyError' && /on-chain/.test(e.message ?? '');
    log(label, {
      rejected: true,
      byContract: onChain,
      contractError: e.code ?? e.message?.slice(0, 160),
    });
  }
}

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const policy = {
    token: XLM_SAC_TESTNET,
    perTxLimit: (5n * XLM).toString(),
    dailyLimit: (20n * XLM).toString(),
    approvalThreshold: (2n * XLM).toString(),
    allowlistEnabled: true,
    allowlist: [merchant],
    expiresAt: now + 30 * 24 * 3600,
    paused: false,
  };

  const contractId =
    existing ??
    (await client.deployAccount({ owner, agentPublicKey: agentKey.publicKey(), policy }));
  log('deploy', { contractId, reused: Boolean(existing) });
  await Bun.write(REPORT, JSON.stringify(report, null, 2) + '\n');

  const balance = await client.getBalance(contractId, XLM_SAC_TESTNET);
  log('balance', `${Number(balance) / 1e7} XLM in the account`);
  if (balance < 10n * XLM) {
    console.log('[fund] the account needs XLM: run the funding step in scripts/testnet/deploy.sh');
    process.exitCode = 2;
    return;
  }

  const agent = new HaloraAgent({ contractId, agentSecret, network: 'testnet' });

  const small = await agent.pay({ to: merchant, amount: 1n * XLM, reason: 'within policy' });
  log('pay-within-policy', small);

  try {
    await agent.pay({ to: merchant, amount: 3n * XLM, reason: 'above threshold' });
    log('pay-above-threshold', { held: false });
    process.exitCode = 1;
  } catch (err) {
    log('pay-above-threshold', { held: true, code: (err as { code?: string }).code });
  }

  const approvalTx = await client.approvePayment({
    contractId,
    owner,
    to: merchant,
    amount: 3n * XLM,
    expiresAt: now + 15 * 60,
  });
  log('owner-approve', { txHash: approvalTx });

  const approved = await agent.pay({ to: merchant, amount: 3n * XLM, reason: 'approved' });
  log('pay-after-approval', approved);
  log('approval-consumed', (await client.getApproval(contractId, merchant)) === null);

  await expectContractRejection('contract-refuses-over-limit', merchant, 10n * XLM, contractId);
  await expectContractRejection(
    'contract-refuses-unknown-recipient',
    owner.publicKey(),
    1n * XLM,
    contractId,
  );

  log('spent-today', `${Number(await client.getSpentToday(contractId)) / 1e7} XLM`);
  report.finishedAt = new Date().toISOString();
  await Bun.write(REPORT, JSON.stringify(report, null, 2) + '\n');
}

main().catch((err) => {
  console.error('[failed]', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
