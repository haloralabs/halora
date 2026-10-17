import {
  computeContractId,
  encodeHaloraSignature,
  encodePolicy,
  getAuthEntryAddress,
} from '@halora/sdk';
import { NETWORK_PASSPHRASES } from '@halora/shared';
import {
  Account,
  Address,
  BASE_FEE,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  xdr,
  type Transaction,
} from '@stellar/stellar-sdk';
import type { Network, Policy } from '@/lib/domain';
import { DataServiceError, type OwnerSession } from '../types';

/**
 * Owner transactions signed by the connected browser wallet: deploy, set_policy, pause, unpause,
 * approve_payment and revoke_approval. Reads go through `@halora/sdk` (see live-service.ts).
 *
 * `@halora/sdk` performs the same writes with a `Keypair`. Browser wallets never expose a key and
 * sign the SEP-43 `signAuthEntry` preimage rather than a raw 32-byte payload, so the flow is
 * reimplemented here on top of the SDK's encoders (see the webapp report for the interface ask).
 */

export const NETWORK_PASSPHRASE: Record<Network, string> = NETWORK_PASSPHRASES;

/** Owner auth signatures stay valid for about 5 minutes. */
const AUTH_VALID_LEDGERS = 60;

export class ChainClient {
  readonly server: rpc.Server;
  readonly passphrase: string;

  constructor(
    rpcUrl: string,
    readonly network: Network,
  ) {
    this.server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://localhost') });
    this.passphrase = NETWORK_PASSPHRASE[network];
  }

  private async source(owner: OwnerSession) {
    try {
      return await this.server.getAccount(owner.publicKey);
    } catch {
      throw new DataServiceError('The owner account is not funded on this network.', 'network');
    }
  }

  private async simulate(tx: Transaction, mode?: rpc.Api.SimulationAuthMode) {
    const sim = await this.server.simulateTransaction(tx, undefined, mode);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new DataServiceError('The contract rejected this change in simulation.', 'invalid');
    }
    return sim;
  }

  /**
   * Builds the call, signs the account's auth entry as `HaloraSignature::Owner` with the wallet,
   * re-simulates in enforcing mode (runs `__check_auth`), then has the wallet sign the envelope.
   * Fails closed if the call needs authorization from anyone else.
   */
  async invokeAsOwner(
    owner: OwnerSession,
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<string> {
    const source = await this.source(owner);
    const sequence = source.sequenceNumber();
    const build = (auth?: xdr.SorobanAuthorizationEntry[]) =>
      // A fresh Account per build: build() increments the sequence in place.
      new TransactionBuilder(new Account(source.accountId(), sequence), {
        fee: BASE_FEE,
        networkPassphrase: this.passphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({ contract: contractId, function: method, args, auth }),
        )
        .setTimeout(120)
        .build();

    const sim = await this.simulate(build());
    const validUntil = sim.latestLedger + AUTH_VALID_LEDGERS;
    const ownerKey = Keypair.fromPublicKey(owner.publicKey);
    const signed: xdr.SorobanAuthorizationEntry[] = [];
    for (const entry of sim.result?.auth ?? []) {
      const address = getAuthEntryAddress(entry);
      if (address === null) {
        signed.push(entry); // source-account credentials, covered by the envelope signature
        continue;
      }
      if (address !== contractId) {
        throw new DataServiceError(
          'This change needs authorization from another party. It was not signed.',
          'signature',
        );
      }
      signed.push(
        await authorizeEntry(
          entry,
          async (preimage, payload) => {
            const signature = await owner.wallet.signAuthEntryPreimage(
              preimage.toXdr('base64'),
              owner.publicKey,
            );
            if (!ownerKey.verify(Buffer.from(payload), Buffer.from(signature))) {
              throw new DataServiceError(
                'The wallet signature does not match your owner key.',
                'signature',
              );
            }
            return {
              signatureScVal: encodeHaloraSignature({
                kind: 'Owner',
                owner: { publicKey: StrKey.decodeEd25519PublicKey(owner.publicKey), signature },
              }),
            };
          },
          validUntil,
          this.passphrase,
        ),
      );
    }
    const tx = build(signed);
    const enforced = await this.simulate(tx, 'enforce');
    return (await this.submit(owner, rpc.assembleTransaction(tx, enforced).build())).hash;
  }

  approvePayment(
    owner: OwnerSession,
    contractId: string,
    to: string,
    amount: string,
    expiresAt: number,
  ) {
    return this.invokeAsOwner(owner, contractId, 'approve_payment', [
      new Address(to).toScVal(),
      nativeToScVal(BigInt(amount), { type: 'i128' }),
      nativeToScVal(BigInt(expiresAt), { type: 'u64' }),
    ]);
  }

  revokeApproval(owner: OwnerSession, contractId: string, to: string) {
    return this.invokeAsOwner(owner, contractId, 'revoke_approval', [new Address(to).toScVal()]);
  }

  setPolicy(owner: OwnerSession, contractId: string, policy: Policy) {
    return this.invokeAsOwner(owner, contractId, 'set_policy', [encodePolicy(policy)]);
  }

  /** Deploys a new halora-account with `__constructor(owner, agent, policy)`. Returns the contract ID. */
  async deployAccount(
    owner: OwnerSession,
    wasmHash: string,
    agentPublicKey: string,
    policy: Policy,
  ): Promise<string> {
    if (!/^[0-9a-f]{64}$/i.test(wasmHash)) {
      throw new DataServiceError(
        'No halora-account WASM hash is configured for this network yet.',
        'not_supported',
      );
    }
    const source = await this.source(owner);
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const contractId = computeContractId(this.passphrase, owner.publicKey, salt);
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: this.passphrase })
      .addOperation(
        Operation.createCustomContract({
          address: new Address(owner.publicKey),
          wasmHash: Buffer.from(wasmHash, 'hex'),
          salt: Buffer.from(salt),
          constructorArgs: [
            xdr.ScVal.scvBytes(StrKey.decodeEd25519PublicKey(owner.publicKey)),
            xdr.ScVal.scvBytes(StrKey.decodeEd25519PublicKey(agentPublicKey)),
            encodePolicy(policy),
          ],
        }),
      )
      .setTimeout(120)
      .build();
    const sim = await this.simulate(tx);
    for (const entry of sim.result?.auth ?? []) {
      if (getAuthEntryAddress(entry) !== null) {
        throw new DataServiceError(
          'Deployment requires unexpected authorization. It was not signed.',
          'signature',
        );
      }
    }
    await this.submit(owner, rpc.assembleTransaction(tx, sim).build());
    return contractId;
  }

  private async submit(owner: OwnerSession, tx: Transaction): Promise<{ hash: string }> {
    const signedXdr = await owner.wallet.signTransaction(tx.toXDR(), owner.publicKey);
    const signed = TransactionBuilder.fromXDR(signedXdr, this.passphrase);
    const sent = await this.server.sendTransaction(signed);
    if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
      throw new DataServiceError('The network rejected the transaction.', 'network');
    }
    const final = await this.server.pollTransaction(sent.hash, { attempts: 30 });
    if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new DataServiceError('The transaction failed on-chain.', 'network');
    }
    return { hash: sent.hash };
  }
}
