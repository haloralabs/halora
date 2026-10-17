/**
 * Dependency-free strkey validation (SEP-23) for the address kinds Halora uses.
 *
 * A strkey is base32(versionByte || payload || crc16xmodem(versionByte || payload)) where the
 * checksum is little-endian. We fully decode and verify the checksum rather than relying on a
 * regex, so a typo in an address is rejected before any money moves. These helpers are
 * cross-checked against `@stellar/stellar-sdk` in the SDK test suite.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const VERSION_BYTES = {
  ed25519PublicKey: 6 << 3, // 'G'
  ed25519SecretSeed: 18 << 3, // 'S'
  contract: 2 << 3, // 'C'
} as const;

export type StrkeyKind = keyof typeof VERSION_BYTES;

function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base32Decode(input: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  // Leftover bits must be zero padding, otherwise the encoding is non-canonical.
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) return null;
  return new Uint8Array(out);
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decodes a strkey of the given kind and returns its 32-byte payload, or null if invalid. */
export function decodeStrkey(kind: StrkeyKind, value: unknown): Uint8Array | null {
  // 32-byte payload + 1 version byte + 2 checksum bytes = 35 bytes = 56 base32 chars.
  if (typeof value !== 'string' || value.length !== 56) return null;
  const decoded = base32Decode(value);
  if (!decoded || decoded.length !== 35) return null;
  if (decoded[0] !== VERSION_BYTES[kind]) return null;
  const body = decoded.subarray(0, 33);
  const expected = crc16xmodem(body);
  const actual = (decoded[33] ?? 0) | ((decoded[34] ?? 0) << 8);
  if (expected !== actual) return null;
  return decoded.slice(1, 33);
}

/** Encodes a 32-byte payload as a strkey of the given kind. */
export function encodeStrkey(kind: StrkeyKind, payload: Uint8Array): string {
  if (payload.length !== 32) throw new Error('strkey payload must be 32 bytes');
  const body = new Uint8Array(33);
  body[0] = VERSION_BYTES[kind];
  body.set(payload, 1);
  const crc = crc16xmodem(body);
  const full = new Uint8Array(35);
  full.set(body, 0);
  full[33] = crc & 0xff;
  full[34] = (crc >>> 8) & 0xff;
  return base32Encode(full);
}

/** True for a valid ed25519 account address (`G...`). */
export function isAccountId(value: unknown): value is string {
  return decodeStrkey('ed25519PublicKey', value) !== null;
}

/** True for a valid contract address (`C...`). */
export function isContractId(value: unknown): value is string {
  return decodeStrkey('contract', value) !== null;
}

/** True for a valid account or contract address (what Soroban calls an `Address`). */
export function isStellarAddress(value: unknown): value is string {
  return isAccountId(value) || isContractId(value);
}

/** True for a valid ed25519 secret seed (`S...`). Never log the value you pass in. */
export function isSecretSeed(value: unknown): value is string {
  return decodeStrkey('ed25519SecretSeed', value) !== null;
}

/** Converts a hex string (64 chars) to a `G...` account ID. Useful for contract BytesN<32> keys. */
export function publicKeyHexToAccountId(hex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('expected 32-byte hex public key');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return encodeStrkey('ed25519PublicKey', bytes);
}

/** Converts a `G...` account ID to its 32-byte hex public key. */
export function accountIdToPublicKeyHex(accountId: string): string {
  const bytes = decodeStrkey('ed25519PublicKey', accountId);
  if (!bytes) throw new Error('invalid account ID');
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
