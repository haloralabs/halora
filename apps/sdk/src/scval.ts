/**
 * ScVal encoding for `halora-account` types.
 *
 * Soroban `#[contracttype]` encoding rules used here:
 * - A struct with named fields is an `ScMap` whose keys are `Symbol(field_name)`, sorted by key.
 * - An enum tuple variant `V(a, b)` is an `ScVec` of `[Symbol("V"), a, b]`.
 * - `BytesN<N>` is `ScBytes` of exactly N bytes; `i128` is `I128`; `u64` is `U64`.
 *
 * So `HaloraSignature::Agent(Signature { public_key, signature })` encodes as:
 *
 *   Vec[ Symbol("Agent"), Map{ Symbol("public_key"): Bytes(32), Symbol("signature"): Bytes(64) } ]
 *
 * and `AgentWithOwner(agent, owner)` as `Vec[Symbol("AgentWithOwner"), Map{..agent}, Map{..owner}]`.
 */

import {
  Address,
  StrKey,
  nativeToScVal,
  scValToNative,
  scvSortedMap,
  xdr,
} from '@stellar/stellar-sdk';
import {
  OnChainApprovalSchema,
  PolicySchema,
  type OnChainApproval,
  type Policy,
} from '@halora/shared';

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

export type Ed25519Signature = {
  /** 32-byte raw ed25519 public key. */
  publicKey: Uint8Array;
  /** 64-byte ed25519 signature over the auth payload hash. */
  signature: Uint8Array;
};

export type HaloraSignature =
  | { kind: 'Agent'; agent: Ed25519Signature }
  | { kind: 'Owner'; owner: Ed25519Signature }
  | { kind: 'AgentWithOwner'; agent: Ed25519Signature; owner: Ed25519Signature };

function sym(name: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(name);
}

function entry(key: string, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({ key: sym(key), val });
}

function encodeSignatureStruct(sig: Ed25519Signature): xdr.ScVal {
  if (sig.publicKey.length !== 32) throw new Error('public key must be 32 bytes');
  if (sig.signature.length !== 64) throw new Error('signature must be 64 bytes');
  return scvSortedMap([
    entry('public_key', xdr.ScVal.scvBytes(sig.publicKey)),
    entry('signature', xdr.ScVal.scvBytes(sig.signature)),
  ]);
}

/** Encodes a `HaloraSignature` enum value for `SorobanAddressCredentials.signature`. */
export function encodeHaloraSignature(sig: HaloraSignature): xdr.ScVal {
  switch (sig.kind) {
    case 'Agent':
      return xdr.ScVal.scvVec([sym('Agent'), encodeSignatureStruct(sig.agent)]);
    case 'Owner':
      return xdr.ScVal.scvVec([sym('Owner'), encodeSignatureStruct(sig.owner)]);
    case 'AgentWithOwner':
      return xdr.ScVal.scvVec([
        sym('AgentWithOwner'),
        encodeSignatureStruct(sig.agent),
        encodeSignatureStruct(sig.owner),
      ]);
  }
}

function decodeSignatureStruct(val: unknown): Ed25519Signature {
  if (!val || typeof val !== 'object') throw new Error('invalid Signature struct');
  const obj = val as Record<string, unknown>;
  const publicKey = obj['public_key'];
  const signature = obj['signature'];
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
    throw new Error('invalid Signature.public_key');
  }
  if (!(signature instanceof Uint8Array) || signature.length !== 64) {
    throw new Error('invalid Signature.signature');
  }
  return { publicKey, signature };
}

/** Decodes a `HaloraSignature` ScVal. Throws on any unexpected shape (fail closed). */
export function decodeHaloraSignature(val: xdr.ScVal): HaloraSignature {
  const native: unknown = scValToNative(val);
  if (!Array.isArray(native) || typeof native[0] !== 'string') {
    throw new Error('invalid HaloraSignature encoding');
  }
  const [tag, ...fields] = native as [string, ...unknown[]];
  if (tag === 'Agent' && fields.length === 1) {
    return { kind: 'Agent', agent: decodeSignatureStruct(fields[0]) };
  }
  if (tag === 'Owner' && fields.length === 1) {
    return { kind: 'Owner', owner: decodeSignatureStruct(fields[0]) };
  }
  if (tag === 'AgentWithOwner' && fields.length === 2) {
    return {
      kind: 'AgentWithOwner',
      agent: decodeSignatureStruct(fields[0]),
      owner: decodeSignatureStruct(fields[1]),
    };
  }
  throw new Error(`unknown HaloraSignature variant: ${tag}`);
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/** Encodes a `Policy` (shared JSON shape) as the contract's `Policy` struct ScVal. */
export function encodePolicy(input: Policy): xdr.ScVal {
  const policy = PolicySchema.parse(input);
  return scvSortedMap([
    entry('allowlist', xdr.ScVal.scvVec(policy.allowlist.map((a) => new Address(a).toScVal()))),
    entry('allowlist_enabled', xdr.ScVal.scvBool(policy.allowlistEnabled)),
    entry('approval_threshold', nativeToScVal(BigInt(policy.approvalThreshold), { type: 'i128' })),
    entry('daily_limit', nativeToScVal(BigInt(policy.dailyLimit), { type: 'i128' })),
    entry('expires_at', nativeToScVal(BigInt(policy.expiresAt), { type: 'u64' })),
    entry('paused', xdr.ScVal.scvBool(policy.paused)),
    entry('per_tx_limit', nativeToScVal(BigInt(policy.perTxLimit), { type: 'i128' })),
    entry('token', new Address(policy.token).toScVal()),
  ]);
}

/** Decodes the contract's `Policy` ScVal into the shared JSON shape, validated with zod. */
export function decodePolicy(val: xdr.ScVal): Policy {
  const raw: unknown = scValToNative(val);
  if (!raw || typeof raw !== 'object') throw new Error('invalid Policy encoding');
  const p = raw as Record<string, unknown>;
  const toStr = (v: unknown): string => {
    if (typeof v === 'bigint' || typeof v === 'number') return v.toString(10);
    throw new Error('invalid Policy amount');
  };
  const expires = p['expires_at'];
  const expiresAt = typeof expires === 'bigint' ? Number(expires) : expires;
  if (typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt)) {
    throw new Error('invalid Policy.expires_at');
  }
  return PolicySchema.parse({
    token: p['token'],
    perTxLimit: toStr(p['per_tx_limit']),
    dailyLimit: toStr(p['daily_limit']),
    approvalThreshold: toStr(p['approval_threshold']),
    allowlistEnabled: p['allowlist_enabled'],
    allowlist: p['allowlist'] ?? [],
    expiresAt,
    paused: p['paused'],
  });
}

/** Decodes `Option<Approval { amount: i128, expires_at: u64 }>`; `None` (void) is null. */
export function decodeApproval(val: xdr.ScVal): OnChainApproval | null {
  if (val.type === 'scvVoid') return null;
  const raw: unknown = scValToNative(val);
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') throw new Error('invalid Approval encoding');
  const a = raw as Record<string, unknown>;
  const amount = a['amount'];
  const expires = a['expires_at'];
  if (typeof amount !== 'bigint' || typeof expires !== 'bigint') {
    throw new Error('invalid Approval encoding');
  }
  return OnChainApprovalSchema.parse({ amount: amount.toString(10), expiresAt: Number(expires) });
}

/** Encodes an `Approval` struct (used by tests and tooling). */
export function encodeApproval(approval: OnChainApproval): xdr.ScVal {
  return scvSortedMap([
    entry('amount', nativeToScVal(BigInt(approval.amount), { type: 'i128' })),
    entry('expires_at', nativeToScVal(BigInt(approval.expiresAt), { type: 'u64' })),
  ]);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** `BytesN<32>` ScVal from a `G...` account ID (owner and agent keys in the constructor). */
export function publicKeyToBytesN(accountId: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(StrKey.decodeEd25519PublicKey(accountId));
}

/** `G...` account ID from a `BytesN<32>` ScVal. */
export function bytesNToPublicKey(val: xdr.ScVal): string {
  const native: unknown = scValToNative(val);
  if (!(native instanceof Uint8Array) || native.length !== 32) {
    throw new Error('expected BytesN<32>');
  }
  return StrKey.encodeEd25519PublicKey(native);
}

export function toI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'i128' });
}

export function fromI128(val: xdr.ScVal): bigint {
  const native: unknown = scValToNative(val);
  if (typeof native !== 'bigint') throw new Error('expected i128');
  return native;
}
