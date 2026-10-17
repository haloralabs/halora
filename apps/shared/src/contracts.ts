/**
 * Deployed contract identifiers per network. The JSON files are the source of truth (contract
 * IDs are data, not code). Empty strings mean "not deployed yet"; use `requireContract` to fail
 * closed instead of passing an empty ID to the network.
 */

import mainnet from './contracts.mainnet.json' with { type: 'json' };
import testnet from './contracts.testnet.json' with { type: 'json' };
import type { Network } from './constants.js';

export type ContractsConfig = {
  /** Hex SHA-256 of the installed `halora-account` WASM, used to deploy new accounts. */
  haloraAccountWasmHash: string;
  /** USDC Stellar Asset Contract ID (C...). */
  usdc: string;
};

export const CONTRACTS: Readonly<Record<Network, Readonly<ContractsConfig>>> = Object.freeze({
  testnet: Object.freeze({ ...testnet }),
  mainnet: Object.freeze({ ...mainnet }),
});

export function getContracts(network: Network): Readonly<ContractsConfig> {
  return CONTRACTS[network];
}

/** Returns a configured contract value or throws if it is still an empty placeholder. */
export function requireContract(network: Network, key: keyof ContractsConfig): string {
  const value = CONTRACTS[network][key];
  if (!value) {
    throw new Error(
      `${key} is not configured for ${network}. Set it in apps/shared/src/contracts.${network}.json.`,
    );
  }
  return value;
}
