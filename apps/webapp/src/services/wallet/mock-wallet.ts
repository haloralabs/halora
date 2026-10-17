import { Keypair, hash } from '@stellar/stellar-sdk';
import type { OwnerWallet } from '../types';

/**
 * Demo wallet for mock mode. It holds an ephemeral, randomly generated keypair in memory for the
 * current tab only, so signatures are real ed25519 signatures but control nothing on any network.
 */
export class MockWallet implements OwnerWallet {
  readonly kind = 'mock' as const;
  private keypair: Keypair | null = null;

  constructor(private readonly latencyMs = 450) {}

  private async pause() {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
  }

  private require(publicKey: string): Keypair {
    if (!this.keypair || this.keypair.publicKey() !== publicKey) {
      throw new Error('The demo wallet is not connected.');
    }
    return this.keypair;
  }

  async connect(): Promise<string> {
    await this.pause();
    this.keypair ??= Keypair.random();
    return this.keypair.publicKey();
  }

  async disconnect(): Promise<void> {
    this.keypair = null;
  }

  async signAuthEntryPreimage(preimageXdr: string, publicKey: string): Promise<Uint8Array> {
    await this.pause();
    // Same as a SEP-43 wallet: sign sha256 of the decoded preimage.
    return new Uint8Array(this.require(publicKey).sign(hash(Buffer.from(preimageXdr, 'base64'))));
  }

  async signTransaction(transactionXdr: string, publicKey: string): Promise<string> {
    await this.pause();
    return Buffer.from(this.require(publicKey).sign(Buffer.from(transactionXdr))).toString(
      'base64',
    );
  }

  async signMessage(message: string, publicKey: string): Promise<string> {
    return Buffer.from(this.require(publicKey).sign(Buffer.from(message))).toString('base64');
  }
}
