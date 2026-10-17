/**
 * Transaction plumbing: build, simulate, assemble, submit, poll. Kept behind a minimal RPC
 * interface so tests can inject a mock and so callers can supply their own `rpc.Server`.
 */

import {
  Account,
  BASE_FEE,
  Operation,
  TransactionBuilder,
  rpc,
  type Keypair,
  type Transaction,
  type xdr,
} from '@stellar/stellar-sdk';
import { HaloraTransactionError, toTypedError } from './errors.js';

/** The subset of `rpc.Server` the SDK uses. `new rpc.Server(url)` satisfies it. */
export type HaloraRpc = Pick<
  rpc.Server,
  'getAccount' | 'getLatestLedger' | 'simulateTransaction' | 'sendTransaction' | 'getTransaction'
>;

export type TxContext = {
  rpc: HaloraRpc;
  networkPassphrase: string;
  /** Timeout for transaction validity, seconds. */
  timeoutSeconds?: number;
  /** Max time to wait for confirmation, ms. */
  confirmTimeoutMs?: number;
  /** Poll interval while waiting for confirmation, ms. */
  pollIntervalMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * A throwaway source used only for read-only simulations. Simulation does not require the
 * source account to exist or sign; nothing built with it is ever submitted.
 */
const SIMULATION_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function buildInvokeTx(
  ctx: TxContext,
  source: Account,
  func: xdr.HostFunction,
  auth: xdr.SorobanAuthorizationEntry[] = [],
): Transaction {
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: ctx.networkPassphrase })
    .addOperation(Operation.invokeHostFunction({ func, auth }))
    .setTimeout(ctx.timeoutSeconds ?? 60)
    .build();
}

export async function simulateOrThrow(
  ctx: TxContext,
  tx: Transaction,
  contractId: string,
  authMode?: rpc.Api.SimulationAuthMode,
): Promise<rpc.Api.SimulateTransactionSuccessResponse> {
  const sim = await ctx.rpc.simulateTransaction(tx, undefined, authMode);
  if (rpc.Api.isSimulationError(sim)) throw toTypedError(sim.error, contractId);
  if (rpc.Api.isSimulationRestore(sim)) {
    throw new HaloraTransactionError(
      'simulation requires a ledger entry restore; restore the archived entries and retry',
    );
  }
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new HaloraTransactionError('unexpected simulation response');
  }
  return sim;
}

/**
 * Simulates with the transaction's own (signed) auth entries in enforcing mode. This executes
 * the account's `__check_auth`, so policy violations surface here as `HaloraPolicyError`.
 */
export function toEnforcedSimulation(
  ctx: TxContext,
  tx: Transaction,
  contractId: string,
): Promise<rpc.Api.SimulateTransactionSuccessResponse> {
  return simulateOrThrow(ctx, tx, contractId, 'enforce');
}

/** Read-only contract call via simulation. Returns the return value ScVal. */
export async function readContract(
  ctx: TxContext,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<xdr.ScVal> {
  const source = new Account(SIMULATION_SOURCE, '0');
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: ctx.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({ contract: contractId, function: method, args }),
    )
    .setTimeout(30)
    .build();
  const sim = await simulateOrThrow(ctx, tx, contractId);
  const retval = sim.result?.retval;
  if (!retval) throw new HaloraTransactionError(`${method}() returned no value`);
  return retval;
}

export type SubmitResult = { txHash: string; ledger: number; returnValue?: xdr.ScVal };

/** Assembles with simulation data, signs with `signer`, submits and waits for the result. */
export async function assembleSignSubmit(
  ctx: TxContext,
  tx: Transaction,
  sim: rpc.Api.SimulateTransactionSuccessResponse,
  signer: Keypair,
  contractId: string,
): Promise<SubmitResult> {
  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(signer);
  return submitAndWait(ctx, assembled, contractId);
}

export async function submitAndWait(
  ctx: TxContext,
  tx: Transaction,
  contractId: string,
): Promise<SubmitResult> {
  const sleep = ctx.sleep ?? defaultSleep;
  const sent = await ctx.rpc.sendTransaction(tx);
  const txHash = sent.hash;
  if (sent.status === 'ERROR') {
    const detail = sent.errorResult ? sent.errorResult.toXdr('base64') : 'unknown error';
    throw toTypedError(`transaction rejected: ${detail}`, contractId, txHash);
  }
  if (sent.status === 'TRY_AGAIN_LATER') {
    throw new HaloraTransactionError('network asked to try again later', { txHash });
  }
  const deadline = Date.now() + (ctx.confirmTimeoutMs ?? 60_000);
  const interval = ctx.pollIntervalMs ?? 1_000;
  for (;;) {
    const res = await ctx.rpc.getTransaction(txHash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { txHash, ledger: res.ledger, returnValue: res.returnValue };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      // Policy denials are normally caught by the enforcing simulation before submission; a
      // failure here usually means state changed in between (for example the daily limit).
      throw new HaloraTransactionError('transaction failed on-chain', { txHash });
    }
    if (Date.now() >= deadline) {
      throw new HaloraTransactionError('timed out waiting for transaction confirmation', {
        txHash,
      });
    }
    await sleep(interval);
  }
}
