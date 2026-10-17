import { Networks } from '@stellar/stellar-sdk';

export type HaloraNetwork = 'testnet' | 'mainnet';

export function networkPassphrase(network: HaloraNetwork): string {
  return network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
}
