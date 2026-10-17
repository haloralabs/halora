export { HaloraAgent, type HaloraAgentOptions } from './agent.js';
export { HaloraClient, computeContractId, type HaloraClientOptions } from './client.js';
export { HaloraApiClient, type FetchLike, type HaloraApiClientOptions } from './api.js';
export {
  attachOwnerSignature,
  coSignAuthEntryAsOwner,
  describeTransferAuthEntry,
  getAuthEntryAddress,
  getAuthEntryPayload,
  keypairSigner,
  signHaloraAuthEntry,
  type HaloraSignRole,
  type PayloadSigner,
  type TransferAuthDetails,
} from './auth.js';
export {
  HaloraApiError,
  HaloraApprovalError,
  HaloraPolicyError,
  HaloraSdkError,
  HaloraTransactionError,
  findAccountContractError,
  isHaloraPolicyError,
} from './errors.js';
export {
  decodeApproval,
  decodeHaloraSignature,
  decodePolicy,
  encodeApproval,
  encodeHaloraSignature,
  encodePolicy,
  type Ed25519Signature,
  type HaloraSignature,
} from './scval.js';
export type { HaloraRpc, TxContext } from './tx.js';
export * as x402 from './x402/index.js';
export type {
  ApprovalPending,
  ApprovalRequest,
  OnChainApproval,
  PaymentResult,
  Policy,
} from '@halora/shared';
