import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Hex-encoded SHA-256 of a UTF-8 string. Used to store API keys and session tokens at rest. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests. Returns false on any length mismatch. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** URL-safe random token with a readable prefix, for example `hk_live_...`. */
export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`;
}

export function randomId(): string {
  return crypto.randomUUID();
}
