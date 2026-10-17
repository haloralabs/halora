/**
 * Network constants shared by every Halora workspace.
 *
 * Mainnet has no SDF-operated public Soroban RPC endpoint, so `DEFAULT_RPC_URLS.mainnet` is
 * `null` and callers must pass an explicit RPC URL from a provider they trust. This is
 * deliberate: we fail closed instead of silently picking a third-party endpoint.
 */

export const NETWORKS = ['testnet', 'mainnet'] as const;
export type Network = (typeof NETWORKS)[number];

export const NETWORK_PASSPHRASES: Readonly<Record<Network, string>> = Object.freeze({
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
});

export const DEFAULT_RPC_URLS: Readonly<Record<Network, string | null>> = Object.freeze({
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: null,
});

export const DEFAULT_HORIZON_URLS: Readonly<Record<Network, string>> = Object.freeze({
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
});

export const FRIENDBOT_URL = 'https://friendbot.stellar.org';

/** USDC uses 7 decimal places on Stellar (as every classic Stellar asset does). */
export const USDC_DECIMALS = 7;

/** Native XLM also uses 7 decimal places (1 XLM = 10,000,000 stroops). */
export const XLM_DECIMALS = 7;

/** Circle USDC issuers on Stellar classic. The SAC contract ID is derived from code + issuer. */
export const USDC_ISSUERS: Readonly<Record<Network, string>> = Object.freeze({
  testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  mainnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
});

/** Soroban i128 bounds, used to validate amounts before they reach the contract. */
export const I128_MAX = (1n << 127n) - 1n;
export const I128_MIN = -(1n << 127n);

/** Soroban u64 max, used for `expiresAt`. */
export const U64_MAX = (1n << 64n) - 1n;

/** Maximum allowlist entries accepted by the contract (`InvalidPolicy` above this). */
export const MAX_ALLOWLIST_LENGTH = 50;

/** Seconds per UTC day bucket, matching the contract (`ledger timestamp / 86400`). */
export const SECONDS_PER_DAY = 86_400;

/** API base path shared by `@halora/api` and its clients. */
export const API_BASE_PATH = '/v1';

export function isNetwork(value: unknown): value is Network {
  return typeof value === 'string' && (NETWORKS as readonly string[]).includes(value);
}

/** Returns the RPC URL to use, or throws when none is configured (mainnet without override). */
export function resolveRpcUrl(network: Network, override?: string): string {
  const url = override ?? DEFAULT_RPC_URLS[network];
  if (!url) {
    throw new Error(
      `No default Soroban RPC URL for ${network}. Pass an explicit rpcUrl from your RPC provider.`,
    );
  }
  return url;
}
