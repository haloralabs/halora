import { HaloraPolicyError, parseHaloraContractError } from '@halora/shared';

export { HaloraPolicyError, isHaloraPolicyError } from '@halora/shared';

/** Base class for SDK errors that are not policy denials. */
export class HaloraSdkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'HaloraSdkError';
  }
}

/** Simulation or submission failed on the network. */
export class HaloraTransactionError extends HaloraSdkError {
  readonly txHash?: string;
  constructor(message: string, opts: { txHash?: string; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = 'HaloraTransactionError';
    this.txHash = opts.txHash;
  }
}

/** The Halora API returned an error or an unexpected payload. */
export class HaloraApiError extends HaloraSdkError {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HaloraApiError';
    this.status = status;
  }
}

/** An approval ended without being approved (rejected, expired) or polling timed out. */
export class HaloraApprovalError extends HaloraSdkError {
  readonly approvalId: string;
  readonly status: string;
  constructor(approvalId: string, status: string, message?: string) {
    super(message ?? `approval ${approvalId} ended with status ${status}`);
    this.name = 'HaloraApprovalError';
    this.approvalId = approvalId;
    this.status = status;
  }
}

const MAX_ERROR_LENGTH = 2_000;

/**
 * Finds a `halora-account` contract error in a simulation or submission error message.
 *
 * Only errors attributed to `contractId` itself are mapped (by scanning diagnostic event lines
 * such as `contract:C..., topics:[error, Error(Contract, #8)]`). A bare `Error(Contract, #N)`
 * could come from the token contract, whose codes overlap ours, so it is not mapped.
 */
export function findAccountContractError(message: string, contractId: string) {
  for (const line of message.split('\n')) {
    if (!line.includes(`contract:${contractId}`)) continue;
    const info = parseHaloraContractError(line);
    if (info) return info;
  }
  return undefined;
}

/**
 * Maps a raw network error message to a typed error. Errors raised by the Halora account
 * become `HaloraPolicyError`; everything else becomes `HaloraTransactionError`.
 */
export function toTypedError(message: string, contractId: string, txHash?: string): Error {
  const info = findAccountContractError(message, contractId);
  if (info) return new HaloraPolicyError(info.name, '(rejected on-chain by the account contract)');
  const trimmed =
    message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}...` : message;
  return new HaloraTransactionError(trimmed, { txHash });
}
