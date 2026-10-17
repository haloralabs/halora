import { randomBytes } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import type { Principal } from '../domain';
import type { Repositories } from '../repositories/types';
import { buildChallengeMessage, verifyOwnerSignature } from '../stellar/owner-auth';
import { randomToken, safeEqualHex, sha256Hex } from '../utils/crypto';
import { badRequest, unauthorized } from '../utils/errors';

export const SESSION_PREFIX = 'hls_';
export const API_KEY_PREFIX = 'hak_';

// A digest that matches nothing, compared against when a key id is unknown so that lookups for
// unknown and known key ids take the same path.
const DUMMY_HASH = sha256Hex('halora-dummy-api-key');

export type AuthServiceOptions = {
  domain: string;
  challengeTtlSeconds: number;
  sessionTtlSeconds: number;
  now: () => Date;
};

export class AuthService {
  constructor(
    private readonly repos: Repositories,
    private readonly opts: AuthServiceOptions,
  ) {}

  async createChallenge(publicKey: string) {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      throw badRequest('publicKey must be a valid Stellar account (G...) address');
    }
    const issuedAt = this.opts.now();
    const expiresAt = new Date(issuedAt.getTime() + this.opts.challengeTtlSeconds * 1000);
    const nonce = randomBytes(16).toString('hex');
    const message = buildChallengeMessage({
      domain: this.opts.domain,
      publicKey,
      nonce,
      issuedAt,
      expiresAt,
    });
    await this.repos.challenges.create({ nonce, publicKey, message, expiresAt });
    return { nonce, message, expiresAt: expiresAt.toISOString() };
  }

  async verifyChallenge(input: { publicKey: string; nonce: string; signature: string }) {
    // Consumed before verification: a nonce can be tried exactly once.
    const challenge = await this.repos.challenges.consume(input.nonce);
    const now = this.opts.now();
    if (
      !challenge ||
      challenge.publicKey !== input.publicKey ||
      challenge.expiresAt <= now ||
      !verifyOwnerSignature(input.publicKey, challenge.message, input.signature)
    ) {
      throw unauthorized('Invalid or expired challenge signature');
    }
    const token = randomToken(SESSION_PREFIX);
    const expiresAt = new Date(now.getTime() + this.opts.sessionTtlSeconds * 1000);
    await this.repos.sessions.create({
      tokenHash: sha256Hex(token),
      publicKey: input.publicKey,
      expiresAt,
    });
    return { token, publicKey: input.publicKey, expiresAt: expiresAt.toISOString() };
  }

  /** Generates a new agent API key. The plaintext is returned once; only its hash is stored. */
  static generateApiKey(): { apiKey: string; apiKeyId: string; apiKeyHash: string } {
    const apiKeyId = randomBytes(9).toString('hex');
    const apiKey = `${API_KEY_PREFIX}${apiKeyId}_${randomBytes(32).toString('base64url')}`;
    return { apiKey, apiKeyId, apiKeyHash: sha256Hex(apiKey) };
  }

  /** Resolves `Authorization: Bearer ...` to a principal, or null when absent or invalid. */
  async authenticate(authorization: string | undefined | null): Promise<Principal | null> {
    if (!authorization) return null;
    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
    if (!match) return null;
    const credential = match[1]!;
    if (credential.length > 256) return null;

    if (credential.startsWith(SESSION_PREFIX)) {
      const session = await this.repos.sessions.findByTokenHash(sha256Hex(credential));
      if (!session || session.expiresAt <= this.opts.now()) return null;
      return { kind: 'owner', publicKey: session.publicKey };
    }

    if (credential.startsWith(API_KEY_PREFIX)) {
      const keyId = credential.slice(API_KEY_PREFIX.length).split('_')[0] ?? '';
      const account = /^[0-9a-f]{18}$/.test(keyId)
        ? await this.repos.accounts.findByApiKeyId(keyId)
        : null;
      const ok = safeEqualHex(sha256Hex(credential), account?.apiKeyHash ?? DUMMY_HASH);
      if (!account || !ok) return null;
      return { kind: 'agent', contractId: account.contractId, account };
    }
    return null;
  }
}
