/**
 * Contract invocations authorized by the Halora account (`__check_auth`).
 *
 * Flow: build -> simulate in recording mode (discovers auth entries and nonces) -> sign the
 * entries that belong to the Halora account with the `HaloraSignature` encoding -> re-simulate
 * in enforcing mode (this runs `__check_auth`, so the policy is checked on the network before
 * anything is submitted, and the footprint includes the account's own storage writes such as
 * `spent_today`) -> assemble -> sign the envelope with the fee-paying source -> submit.
 */

import type { Keypair } from '@stellar/stellar-sdk';
import {
  Account,
  BASE_FEE,
  Operation,
  TransactionBuilder,
  rpc,
  type Transaction,
  type xdr,
} from '@stellar/stellar-sdk';
import {
  getAuthEntryAddress,
  keypairSigner,
  signHaloraAuthEntry,
  type HaloraSignRole,
} from './auth.js';
import { HaloraTransactionError } from './errors.js';
import {
  simulateOrThrow,
  submitAndWait,
  toEnforcedSimulation,
  type SubmitResult,
  type TxContext,
} from './tx.js';

export type PreparedInvocation = {
  /** Fresh source account snapshot (sequence not yet consumed). */
  sourceAccountId: string;
  sourceSequence: string;
  func: xdr.HostFunction;
  /** Auth entries with the Halora account entry signed. */
  auth: xdr.SorobanAuthorizationEntry[];
  /** The signed Halora account entry. */
  haloraEntry: xdr.SorobanAuthorizationEntry;
  latestLedger: number;
  validUntilLedgerSeq: number;
};

export type PrepareOptions = {
  ctx: TxContext;
  /** The Halora account contract whose auth is being provided. */
  contractId: string;
  /** Contract to call (the account itself for owner methods, the token for payments). */
  callContract: string;
  method: string;
  args: xdr.ScVal[];
  role: HaloraSignRole;
  signer: Keypair;
  /** Transaction source (fee payer). Must exist on-chain unless `allowUnfundedSource`. */
  sourcePublicKey: string;
  validForLedgers: number;
  /** For x402: the facilitator rebuilds with its own source, so ours may not exist. */
  allowUnfundedSource?: boolean;
};

async function loadSource(
  ctx: TxContext,
  publicKey: string,
  allowUnfunded: boolean,
): Promise<Account> {
  try {
    return await ctx.rpc.getAccount(publicKey);
  } catch (err) {
    if (allowUnfunded) return new Account(publicKey, '0');
    throw new HaloraTransactionError(
      `source account ${publicKey} could not be loaded; it must exist and hold XLM for fees`,
      { cause: err },
    );
  }
}

function buildTx(
  ctx: TxContext,
  accountId: string,
  sequence: string,
  func: xdr.HostFunction,
  auth: xdr.SorobanAuthorizationEntry[],
): Transaction {
  // A fresh Account per build: TransactionBuilder.build() increments the sequence in place.
  return new TransactionBuilder(new Account(accountId, sequence), {
    fee: BASE_FEE,
    networkPassphrase: ctx.networkPassphrase,
  })
    .addOperation(Operation.invokeHostFunction({ func, auth }))
    .setTimeout(ctx.timeoutSeconds ?? 60)
    .build();
}

/** Simulates in recording mode and signs the Halora account's auth entry. Does not submit. */
export async function prepareHaloraInvocation(opts: PrepareOptions): Promise<PreparedInvocation> {
  const { ctx, contractId } = opts;
  const source = await loadSource(ctx, opts.sourcePublicKey, opts.allowUnfundedSource ?? false);
  const sourceSequence = source.sequenceNumber();
  const draft = new TransactionBuilder(new Account(source.accountId(), sourceSequence), {
    fee: BASE_FEE,
    networkPassphrase: ctx.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: opts.callContract,
        function: opts.method,
        args: opts.args,
      }),
    )
    .setTimeout(ctx.timeoutSeconds ?? 60)
    .build();
  const op = draft.operations[0];
  if (!op || op.type !== 'invokeHostFunction') throw new Error('expected invokeHostFunction');

  const sim = await simulateOrThrow(ctx, draft, contractId);
  const entries = sim.result?.auth ?? [];
  const validUntilLedgerSeq = sim.latestLedger + opts.validForLedgers;
  const signer = keypairSigner(opts.signer);

  let haloraEntry: xdr.SorobanAuthorizationEntry | undefined;
  const auth: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of entries) {
    const address = getAuthEntryAddress(entry);
    if (address === null && entry.credentials.type === 'sorobanCredentialsSourceAccount') {
      auth.push(entry); // authorized by the envelope signature of the source
      continue;
    }
    if (address !== contractId || haloraEntry) {
      // Fail closed: we never sign, or submit, an invocation that needs other parties' auth.
      throw new HaloraTransactionError('invocation requires unexpected authorization entries');
    }
    haloraEntry = await signHaloraAuthEntry({
      entry,
      contractId,
      role: opts.role,
      signer,
      validUntilLedgerSeq,
      networkPassphrase: ctx.networkPassphrase,
    });
    auth.push(haloraEntry);
  }
  if (!haloraEntry) {
    throw new HaloraTransactionError('invocation did not require the Halora account authorization');
  }
  return {
    sourceAccountId: source.accountId(),
    sourceSequence,
    func: op.func,
    auth,
    haloraEntry,
    latestLedger: sim.latestLedger,
    validUntilLedgerSeq,
  };
}

/**
 * Builds the final transaction with the given auth entries, simulates it in enforcing mode
 * (running `__check_auth`) and returns the assembled, unsigned transaction.
 */
export async function assembleWithAuth(
  ctx: TxContext,
  contractId: string,
  prepared: Pick<PreparedInvocation, 'sourceAccountId' | 'sourceSequence' | 'func'>,
  auth: xdr.SorobanAuthorizationEntry[],
): Promise<Transaction> {
  const tx = buildTx(ctx, prepared.sourceAccountId, prepared.sourceSequence, prepared.func, auth);
  const sim = await toEnforcedSimulation(ctx, tx, contractId);
  return rpc.assembleTransaction(tx, sim).build();
}

/** Full flow: prepare, enforce-simulate, sign the envelope with `feePayer`, submit, wait. */
export async function invokeWithHaloraAuth(
  opts: PrepareOptions & { feePayer: Keypair },
): Promise<SubmitResult> {
  const prepared = await prepareHaloraInvocation(opts);
  const tx = await assembleWithAuth(opts.ctx, opts.contractId, prepared, prepared.auth);
  tx.sign(opts.feePayer);
  return submitAndWait(opts.ctx, tx, opts.contractId);
}
