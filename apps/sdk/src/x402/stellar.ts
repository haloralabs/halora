/**
 * Stellar specifics of the x402 `exact` scheme (scheme_exact_stellar.md):
 * CAIP-2 network IDs, ledger-based auth expiry, and requirement selection.
 */

import type { Network } from '@halora/shared';
import type { PaymentRequirements } from './types.js';

export const X402_STELLAR_NETWORKS: Readonly<Record<Network, string>> = Object.freeze({
  testnet: 'stellar:testnet',
  mainnet: 'stellar:pubnet',
});

/** Spec fallback when no network estimate is available. */
export const ESTIMATED_LEDGER_SECONDS = 5;

/** `ceil(maxTimeoutSeconds / estimatedLedgerSeconds)`, at least 1. */
export function ledgerTimeout(
  maxTimeoutSeconds: number,
  ledgerSeconds = ESTIMATED_LEDGER_SECONDS,
): number {
  return Math.max(1, Math.ceil(maxTimeoutSeconds / ledgerSeconds));
}

/**
 * Picks the first `exact` requirement on our network whose asset is the policy token and whose
 * fees are sponsored (the only flow the spec currently defines). Fails closed: returns
 * undefined rather than guessing.
 */
export function selectStellarRequirement(
  accepts: PaymentRequirements[],
  network: Network,
  token: string,
): PaymentRequirements | undefined {
  return accepts.find(
    (r) =>
      r.scheme === 'exact' &&
      r.network === X402_STELLAR_NETWORKS[network] &&
      r.asset === token &&
      r.extra?.['areFeesSponsored'] === true,
  );
}
