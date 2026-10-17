import { config } from '@/lib/config';
import { LiveDataService } from './live/live-service';
import { MockDataService } from './mock/mock-service';
import type { HaloraDataService, OwnerWallet } from './types';
import { KitWallet } from './wallet/kit-wallet';
import { MockWallet } from './wallet/mock-wallet';
import { contracts } from './contracts';

export type { HaloraDataService, OwnerSession, OwnerWallet } from './types';
export { DataServiceError } from './types';

let service: HaloraDataService | null = null;
let wallet: OwnerWallet | null = null;

/** The data service selected by NEXT_PUBLIC_HALORA_DATA_MODE (mock by default). */
export function getDataService(): HaloraDataService {
  service ??=
    config.dataMode === 'live'
      ? new LiveDataService({
          apiUrl: config.apiUrl,
          rpcUrl: config.rpcUrl,
          network: config.network,
          wasmHash: contracts.haloraAccountWasmHash,
          usdc: contracts.usdc,
        })
      : new MockDataService();
  return service;
}

export function getOwnerWallet(): OwnerWallet {
  wallet ??= config.dataMode === 'live' ? new KitWallet(config.network) : new MockWallet();
  return wallet;
}

/** Default token for new policies: USDC on the configured network. */
export function defaultToken(): string {
  const svc = getDataService();
  return svc instanceof MockDataService ? svc.usdcContractId : contracts.usdc;
}

/** Test hook: replace the singletons. */
export function __setServicesForTest(next: { service?: HaloraDataService; wallet?: OwnerWallet }) {
  if (next.service) service = next.service;
  if (next.wallet) wallet = next.wallet;
}
