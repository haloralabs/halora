import type { Network } from '@/lib/domain';
import { NETWORK_PASSPHRASE } from '../live/chain';
import { decodeWalletSignature } from '../live/auth-entry';
import type { OwnerWallet } from '../types';

type Kit = typeof import('@creit.tech/stellar-wallets-kit').StellarWalletsKit;

/**
 * Owner wallet backed by Stellar Wallets Kit (Freighter, xBull, Lobstr, Albedo and other SEP-43
 * wallets). The kit is imported lazily in the browser so it never runs during server rendering.
 */
export class KitWallet implements OwnerWallet {
  readonly kind = 'kit' as const;
  private kit: Promise<Kit> | null = null;

  constructor(private readonly network: Network) {}

  private load(): Promise<Kit> {
    this.kit ??= (async () => {
      const mod = await import('@creit.tech/stellar-wallets-kit');
      const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');
      mod.StellarWalletsKit.init({
        modules: defaultModules(),
        network: this.network === 'mainnet' ? mod.Networks.PUBLIC : mod.Networks.TESTNET,
      });
      return mod.StellarWalletsKit;
    })();
    return this.kit;
  }

  private get passphrase() {
    return NETWORK_PASSPHRASE[this.network];
  }

  async connect(): Promise<string> {
    const kit = await this.load();
    const { address } = await kit.authModal();
    return address;
  }

  async disconnect(): Promise<void> {
    if (!this.kit) return;
    await (await this.kit).disconnect();
  }

  async signAuthEntryPreimage(preimageXdr: string, publicKey: string): Promise<Uint8Array> {
    const kit = await this.load();
    const { signedAuthEntry } = await kit.signAuthEntry(preimageXdr, {
      address: publicKey,
      networkPassphrase: this.passphrase,
    });
    return decodeWalletSignature(signedAuthEntry);
  }

  async signTransaction(transactionXdr: string, publicKey: string): Promise<string> {
    const kit = await this.load();
    const { signedTxXdr } = await kit.signTransaction(transactionXdr, {
      address: publicKey,
      networkPassphrase: this.passphrase,
    });
    return signedTxXdr;
  }

  async signMessage(message: string, publicKey: string): Promise<string> {
    const kit = await this.load();
    const { signedMessage } = await kit.signMessage(message, {
      address: publicKey,
      networkPassphrase: this.passphrase,
    });
    return signedMessage;
  }
}
