/**
 * Signing of Soroban authorization entries for the `halora-account` custom account.
 *
 * The signed payload is the standard Soroban one: sha256(HashIdPreimage) built from the
 * network ID, nonce, signature expiration ledger and invocation tree (address-bound for
 * CAP-71 V2 credentials). `@stellar/stellar-sdk` builds the preimage for both credential arms;
 * we only supply the custom `HaloraSignature` ScVal that `__check_auth` expects.
 */

import {
  Address,
  Keypair,
  StrKey,
  authorizeEntry,
  buildAuthorizationEntryPreimage,
  hash,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { decodeHaloraSignature, encodeHaloraSignature, type Ed25519Signature } from './scval.js';

/** Something that can sign a 32-byte payload with an ed25519 key (a Keypair, an HSM, a wallet). */
export type PayloadSigner = {
  publicKey: string;
  sign(payload: Uint8Array): Uint8Array | Promise<Uint8Array>;
};

export function keypairSigner(keypair: Keypair): PayloadSigner {
  return { publicKey: keypair.publicKey(), sign: (payload) => keypair.sign(payload) };
}

type AddressCredentials = xdr.SorobanAddressCredentials;

/** Returns the address credentials of an entry, or null for source-account credentials. */
export function getAddressCredentials(
  entry: xdr.SorobanAuthorizationEntry,
): AddressCredentials | null {
  const creds = entry.credentials;
  switch (creds.type) {
    case 'sorobanCredentialsAddress':
      return creds.address;
    case 'sorobanCredentialsAddressV2':
      return creds.addressV2;
    default:
      // Source-account credentials need no signature here; delegate credentials are not
      // supported by Halora and are treated as foreign (never signed).
      return null;
  }
}

/** The address (G... or C...) an entry authorizes for, or null for source-account credentials. */
export function getAuthEntryAddress(entry: xdr.SorobanAuthorizationEntry): string | null {
  const creds = getAddressCredentials(entry);
  return creds ? Address.fromScAddress(creds.address).toString() : null;
}

/** sha256 payload that every signer of this entry must sign. */
export function getAuthEntryPayload(
  entry: xdr.SorobanAuthorizationEntry,
  networkPassphrase: string,
  validUntilLedgerSeq?: number,
): Uint8Array {
  const creds = getAddressCredentials(entry);
  if (!creds) throw new Error('auth entry has no address credentials');
  const expiration = validUntilLedgerSeq ?? creds.signatureExpirationLedger;
  const preimage = buildAuthorizationEntryPreimage(entry, expiration, networkPassphrase);
  return hash(preimage.toXdr());
}

async function signPayload(signer: PayloadSigner, payload: Uint8Array): Promise<Ed25519Signature> {
  const signature = await signer.sign(payload);
  const publicKey = StrKey.decodeEd25519PublicKey(signer.publicKey);
  if (!Keypair.fromPublicKey(signer.publicKey).verify(payload, signature)) {
    throw new Error('signer produced an invalid signature');
  }
  return { publicKey, signature };
}

export type HaloraSignRole = 'Agent' | 'Owner';

/**
 * Signs an auth entry for the Halora account with a single key (`Agent` or `Owner` variant).
 * Refuses to sign entries for any address other than `contractId`.
 */
export async function signHaloraAuthEntry(opts: {
  entry: xdr.SorobanAuthorizationEntry;
  contractId: string;
  role: HaloraSignRole;
  signer: PayloadSigner;
  validUntilLedgerSeq: number;
  networkPassphrase: string;
}): Promise<xdr.SorobanAuthorizationEntry> {
  const { entry, contractId, role, signer, validUntilLedgerSeq, networkPassphrase } = opts;
  const address = getAuthEntryAddress(entry);
  if (address !== contractId) {
    throw new Error('refusing to sign an auth entry for a different address');
  }
  return authorizeEntry(
    entry,
    async (_preimage, payload) => {
      const sig = await signPayload(signer, payload);
      const signatureScVal =
        role === 'Agent'
          ? encodeHaloraSignature({ kind: 'Agent', agent: sig })
          : encodeHaloraSignature({ kind: 'Owner', owner: sig });
      return { signatureScVal };
    },
    validUntilLedgerSeq,
    networkPassphrase,
  );
}

/** Replaces the signature of an address-credential entry, keeping nonce and expiration. */
function withSignature(
  entry: xdr.SorobanAuthorizationEntry,
  signature: xdr.ScVal,
): xdr.SorobanAuthorizationEntry {
  const creds = getAddressCredentials(entry);
  if (!creds) throw new Error('auth entry has no address credentials');
  const next = new xdr.SorobanAddressCredentials({
    address: creds.address,
    nonce: creds.nonce,
    signatureExpirationLedger: creds.signatureExpirationLedger,
    signature,
  });
  const credentials =
    entry.credentials.type === 'sorobanCredentialsAddressV2'
      ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(next)
      : xdr.SorobanCredentials.sorobanCredentialsAddress(next);
  return new xdr.SorobanAuthorizationEntry({ credentials, rootInvocation: entry.rootInvocation });
}

/**
 * Owner co-signature for an approval. Takes the agent-signed entry (`Agent` variant), signs the
 * same payload with the owner key, and returns base64 XDR with `AgentWithOwner(agent, owner)`.
 * The expiration ledger is the one the agent committed to; it cannot be extended here.
 */
export async function coSignAuthEntryAsOwner(opts: {
  authEntryXdr: string;
  owner: PayloadSigner;
  networkPassphrase: string;
}): Promise<string> {
  const entry = xdr.SorobanAuthorizationEntry.fromXdr(opts.authEntryXdr, 'base64');
  const creds = getAddressCredentials(entry);
  if (!creds) throw new Error('auth entry has no address credentials');
  const existing = decodeHaloraSignature(creds.signature);
  if (existing.kind !== 'Agent') throw new Error('expected an agent-signed auth entry');
  const payload = getAuthEntryPayload(entry, opts.networkPassphrase);
  const owner = await signPayload(opts.owner, payload);
  const combined = encodeHaloraSignature({ kind: 'AgentWithOwner', agent: existing.agent, owner });
  return withSignature(entry, combined).toXdr('base64');
}

/** Combines an agent-signed entry with an externally produced owner signature (wallets). */
export function attachOwnerSignature(opts: {
  authEntryXdr: string;
  ownerPublicKey: string;
  ownerSignature: Uint8Array;
  networkPassphrase: string;
}): string {
  const entry = xdr.SorobanAuthorizationEntry.fromXdr(opts.authEntryXdr, 'base64');
  const creds = getAddressCredentials(entry);
  if (!creds) throw new Error('auth entry has no address credentials');
  const existing = decodeHaloraSignature(creds.signature);
  if (existing.kind !== 'Agent') throw new Error('expected an agent-signed auth entry');
  const payload = getAuthEntryPayload(entry, opts.networkPassphrase);
  if (!Keypair.fromPublicKey(opts.ownerPublicKey).verify(payload, opts.ownerSignature)) {
    throw new Error('owner signature does not verify against the auth entry payload');
  }
  const combined = encodeHaloraSignature({
    kind: 'AgentWithOwner',
    agent: existing.agent,
    owner: {
      publicKey: StrKey.decodeEd25519PublicKey(opts.ownerPublicKey),
      signature: opts.ownerSignature,
    },
  });
  return withSignature(entry, combined).toXdr('base64');
}

export type TransferAuthDetails = {
  /** Account whose auth this is (the Halora contract for agent payments). */
  from: string;
  token: string;
  to: string;
  amount: bigint;
  signatureExpirationLedger: number;
};

/**
 * Parses an auth entry that authorizes exactly one `token.transfer(from, to, amount)` with no
 * sub-invocations. Throws for anything else, so callers (the owner UI, the agent before
 * submitting an approved entry) can verify what is being signed.
 */
export function describeTransferAuthEntry(
  entryOrXdr: xdr.SorobanAuthorizationEntry | string,
): TransferAuthDetails {
  const entry =
    typeof entryOrXdr === 'string'
      ? xdr.SorobanAuthorizationEntry.fromXdr(entryOrXdr, 'base64')
      : entryOrXdr;
  const creds = getAddressCredentials(entry);
  if (!creds) throw new Error('auth entry has no address credentials');
  const inv = entry.rootInvocation;
  if (inv.subInvocations.length !== 0) throw new Error('unexpected sub-invocations');
  const fn = inv.function;
  if (fn.type !== 'sorobanAuthorizedFunctionTypeContractFn') {
    throw new Error('auth entry is not a contract call');
  }
  const call = fn.contractFn;
  if (call.functionName.toString() !== 'transfer' || call.args.length !== 3) {
    throw new Error('auth entry is not a token transfer');
  }
  const [fromVal, toVal, amountVal] = call.args as [xdr.ScVal, xdr.ScVal, xdr.ScVal];
  const from = Address.fromScVal(fromVal).toString();
  const signer = Address.fromScAddress(creds.address).toString();
  if (from !== signer) throw new Error('transfer `from` does not match the authorizing address');
  const amount: unknown = scValToNative(amountVal);
  if (typeof amount !== 'bigint' || amountVal.type !== 'scvI128') {
    throw new Error('transfer amount is not an i128');
  }
  return {
    from,
    token: Address.fromScAddress(call.contractAddress).toString(),
    to: Address.fromScVal(toVal).toString(),
    amount,
    signatureExpirationLedger: creds.signatureExpirationLedger,
  };
}
