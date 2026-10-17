import { Keypair, StrKey, hash } from '@stellar/stellar-sdk';

/**
 * Owner sign-in message, modeled on SIWE/CAIP-122. The domain and an expiry are part of the
 * signed text so a signature cannot be replayed against another service or after it expires.
 */
export function buildChallengeMessage(opts: {
  domain: string;
  publicKey: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    `${opts.domain} wants you to sign in to Halora with your Stellar account:`,
    opts.publicKey,
    '',
    'This request does not authorize any payment or transaction.',
    '',
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt.toISOString()}`,
    `Expiration Time: ${opts.expiresAt.toISOString()}`,
  ].join('\n');
}

const SEP53_PREFIX = 'Stellar Signed Message:\n';

/**
 * Verifies an ed25519 signature over the challenge. Two encodings are accepted:
 * 1. a raw signature over the UTF-8 message bytes (Keypair.sign in scripts and the SDK), and
 * 2. a SEP-53 signature over sha256("Stellar Signed Message:\n" + message), which is what
 *    wallets such as Freighter produce for `signMessage`.
 */
export function verifyOwnerSignature(
  publicKey: string,
  message: string,
  signatureB64: string,
): boolean {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) return false;
  let sig: Buffer;
  try {
    sig = Buffer.from(signatureB64, 'base64');
  } catch {
    return false;
  }
  if (sig.length !== 64) return false;
  const kp = Keypair.fromPublicKey(publicKey);
  const raw = Buffer.from(message, 'utf8');
  const sep53 = hash(Buffer.concat([Buffer.from(SEP53_PREFIX, 'utf8'), raw]));
  try {
    return kp.verify(raw, sig) || kp.verify(sep53, sig);
  } catch {
    return false;
  }
}
