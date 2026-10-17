/**
 * `HaloraClient`: owner-side operations (deploy, configure) and read-only views.
 * See docs/architecture/interfaces.md section 4.
 */

import type { Keypair } from '@stellar/stellar-sdk';
import {
  Address,
  BASE_FEE,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import {
  CONTRACTS,
  ContractIdSchema,
  NETWORK_PASSPHRASES,
  AccountIdSchema,
  AddressSchema,
  PolicySchema,
  resolveRpcUrl,
  type Network,
  type OnChainApproval,
  type Policy,
} from '@halora/shared';
import { HaloraSdkError, HaloraTransactionError } from './errors.js';
import { invokeWithHaloraAuth } from './invoke.js';
import {
  bytesNToPublicKey,
  decodeApproval,
  decodePolicy,
  encodePolicy,
  fromI128,
  publicKeyToBytesN,
  toI128,
} from './scval.js';
import {
  readContract,
  simulateOrThrow,
  submitAndWait,
  type HaloraRpc,
  type TxContext,
} from './tx.js';

export type HaloraClientOptions = {
  network: Network;
  /** Soroban RPC URL. Required on mainnet (there is no default public mainnet endpoint). */
  rpcUrl?: string;
  /** Halora API base URL (for example https://api.halora.example). */
  apiUrl?: string;
  /** Inject an RPC implementation (tests, custom transport). Overrides `rpcUrl`. */
  rpc?: HaloraRpc;
  /** Override the `halora-account` WASM hash (hex). Defaults to contracts.<network>.json. */
  wasmHash?: string;
  /** Ledgers an owner auth signature stays valid (default 60, about 5 minutes). */
  authValidForLedgers?: number;
  /** Confirmation timeout and poll interval overrides. */
  confirmTimeoutMs?: number;
  pollIntervalMs?: number;
};

export class HaloraClient {
  readonly network: Network;
  readonly networkPassphrase: string;
  readonly apiUrl?: string;
  protected readonly ctx: TxContext;
  private readonly wasmHash?: string;
  private readonly authValidForLedgers: number;

  constructor(opts: HaloraClientOptions) {
    this.network = opts.network;
    this.networkPassphrase = NETWORK_PASSPHRASES[opts.network];
    this.apiUrl = opts.apiUrl;
    const server: HaloraRpc =
      opts.rpc ??
      new rpc.Server(resolveRpcUrl(opts.network, opts.rpcUrl), {
        allowHttp: (opts.rpcUrl ?? '').startsWith('http://localhost'),
      });
    this.ctx = {
      rpc: server,
      networkPassphrase: this.networkPassphrase,
      confirmTimeoutMs: opts.confirmTimeoutMs,
      pollIntervalMs: opts.pollIntervalMs,
    };
    this.wasmHash = opts.wasmHash ?? (CONTRACTS[opts.network].haloraAccountWasmHash || undefined);
    this.authValidForLedgers = opts.authValidForLedgers ?? 60;
  }

  /** Underlying RPC context (advanced use). */
  get txContext(): TxContext {
    return this.ctx;
  }

  /**
   * Deploys a new `halora-account` instance owned by `owner`. The owner account pays the fees
   * and must exist on-chain. Returns the new contract ID (C...).
   */
  async deployAccount(opts: {
    owner: Keypair;
    agentPublicKey: string;
    policy: Policy;
    /** 32-byte salt; random by default. */
    salt?: Uint8Array;
  }): Promise<string> {
    const wasmHashHex = this.wasmHash;
    if (!wasmHashHex || !/^[0-9a-fA-F]{64}$/.test(wasmHashHex)) {
      throw new HaloraSdkError(
        `halora-account WASM hash is not configured for ${this.network}; pass wasmHash or set contracts.${this.network}.json`,
      );
    }
    AccountIdSchema.parse(opts.agentPublicKey);
    const policy = PolicySchema.parse(opts.policy);
    if (opts.agentPublicKey === opts.owner.publicKey()) {
      throw new HaloraSdkError('agent key must differ from the owner key');
    }
    const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(32));
    if (salt.length !== 32) throw new HaloraSdkError('salt must be 32 bytes');

    const ownerAddress = new Address(opts.owner.publicKey());
    const contractId = computeContractId(this.networkPassphrase, opts.owner.publicKey(), salt);

    const source = await this.ctx.rpc.getAccount(opts.owner.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.createCustomContract({
          address: ownerAddress,
          wasmHash: hexToBytes(wasmHashHex),
          salt,
          constructorArgs: [
            publicKeyToBytesN(opts.owner.publicKey()),
            publicKeyToBytesN(opts.agentPublicKey),
            encodePolicy(policy),
          ],
        }),
      )
      .setTimeout(60)
      .build();
    const sim = await simulateOrThrow(this.ctx, tx, contractId);
    // Deployment only needs the owner's source-account authorization.
    for (const entry of sim.result?.auth ?? []) {
      if (entry.credentials.type !== 'sorobanCredentialsSourceAccount') {
        throw new HaloraTransactionError('deployment requires unexpected authorization entries');
      }
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(opts.owner);
    const result = await submitAndWait(this.ctx, assembled, contractId);
    if (result.returnValue) {
      const returned = Address.fromScVal(result.returnValue).toString();
      if (returned !== contractId) {
        throw new HaloraTransactionError('deployed contract ID does not match the derived ID', {
          txHash: result.txHash,
        });
      }
    }
    return contractId;
  }

  async getPolicy(contractId: string): Promise<Policy> {
    ContractIdSchema.parse(contractId);
    return decodePolicy(await readContract(this.ctx, contractId, 'policy'));
  }

  async getSpentToday(contractId: string): Promise<bigint> {
    ContractIdSchema.parse(contractId);
    return fromI128(await readContract(this.ctx, contractId, 'spent_today'));
  }

  async getOwner(contractId: string): Promise<string> {
    return bytesNToPublicKey(
      await readContract(this.ctx, ContractIdSchema.parse(contractId), 'owner'),
    );
  }

  async getAgent(contractId: string): Promise<string> {
    return bytesNToPublicKey(
      await readContract(this.ctx, ContractIdSchema.parse(contractId), 'agent'),
    );
  }

  /** SEP-41 token balance of the account. Defaults to the policy token. */
  async getBalance(contractId: string, token?: string): Promise<bigint> {
    ContractIdSchema.parse(contractId);
    const tokenId = token ?? (await this.getPolicy(contractId)).token;
    const val = await readContract(this.ctx, tokenId, 'balance', [
      new Address(contractId).toScVal(),
    ]);
    return fromI128(val);
  }

  /** On-chain one-time pre-approval for `to`, or null when none exists. */
  async getApproval(contractId: string, to: string): Promise<OnChainApproval | null> {
    ContractIdSchema.parse(contractId);
    AddressSchema.parse(to);
    const val = await readContract(this.ctx, contractId, 'approval', [new Address(to).toScVal()]);
    return decodeApproval(val);
  }

  /**
   * Owner pre-approves one agent payment to `to` of at most `amount`, valid until `expiresAt`
   * (unix seconds). Replaces any existing approval for `to`. Consumed by the next agent transfer
   * to `to` that is above the threshold. Per-payment and daily limits still apply.
   * Returns the transaction hash (post it to the API as `approvalTxHash`).
   */
  async approvePayment(opts: {
    contractId: string;
    owner: Keypair;
    to: string;
    amount: bigint;
    expiresAt: number;
  }): Promise<string> {
    AddressSchema.parse(opts.to);
    if (opts.amount <= 0n) throw new HaloraSdkError('approval amount must be positive');
    if (!Number.isSafeInteger(opts.expiresAt) || opts.expiresAt <= Math.floor(Date.now() / 1000)) {
      throw new HaloraSdkError('approval expiresAt must be a future unix timestamp in seconds');
    }
    return this.ownerInvoke(opts.contractId, opts.owner, 'approve_payment', [
      new Address(opts.to).toScVal(),
      toI128(opts.amount),
      nativeToScVal(BigInt(opts.expiresAt), { type: 'u64' }),
    ]);
  }

  async revokeApproval(opts: { contractId: string; owner: Keypair; to: string }): Promise<string> {
    AddressSchema.parse(opts.to);
    return this.ownerInvoke(opts.contractId, opts.owner, 'revoke_approval', [
      new Address(opts.to).toScVal(),
    ]);
  }

  async setPolicy(opts: { contractId: string; owner: Keypair; policy: Policy }): Promise<void> {
    await this.ownerInvoke(opts.contractId, opts.owner, 'set_policy', [
      encodePolicy(PolicySchema.parse(opts.policy)),
    ]);
  }

  async setAgent(opts: {
    contractId: string;
    owner: Keypair;
    agentPublicKey: string;
  }): Promise<void> {
    AccountIdSchema.parse(opts.agentPublicKey);
    await this.ownerInvoke(opts.contractId, opts.owner, 'set_agent', [
      publicKeyToBytesN(opts.agentPublicKey),
    ]);
  }

  async pause(opts: { contractId: string; owner: Keypair }): Promise<void> {
    await this.ownerInvoke(opts.contractId, opts.owner, 'pause', []);
  }

  async unpause(opts: { contractId: string; owner: Keypair }): Promise<void> {
    await this.ownerInvoke(opts.contractId, opts.owner, 'unpause', []);
  }

  /** Owner-authorized call on the account itself. The owner account pays the fees. */
  private async ownerInvoke(
    contractId: string,
    owner: Keypair,
    method: string,
    args: xdr.ScVal[],
  ): Promise<string> {
    ContractIdSchema.parse(contractId);
    const result = await invokeWithHaloraAuth({
      ctx: this.ctx,
      contractId,
      callContract: contractId,
      method,
      args,
      role: 'Owner',
      signer: owner,
      sourcePublicKey: owner.publicKey(),
      feePayer: owner,
      validForLedgers: this.authValidForLedgers,
    });
    return result.txHash;
  }
}

/** Deterministic contract ID for a deployer address and salt (CAP-46 contract ID preimage). */
export function computeContractId(
  networkPassphrase: string,
  deployer: string,
  salt: Uint8Array,
): string {
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(networkPassphrase),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(deployer).toScAddress(),
          salt,
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(preimage.toXdr()));
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
