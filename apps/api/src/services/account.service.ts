import type { AgentAccount, PaymentRecord, Principal, StoredAccount } from '../domain';
import { DuplicateError, type Repositories } from '../repositories/types';
import type { ChainReader } from '../stellar/chain';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../utils/errors';
import type { Logger } from '../utils/logger';
import { AuthService } from './auth.service';

export function toPublicAccount(a: StoredAccount): AgentAccount {
  return {
    contractId: a.contractId,
    ownerPublicKey: a.ownerPublicKey,
    agentPublicKey: a.agentPublicKey,
    label: a.label,
    network: a.network,
    createdAt: a.createdAt,
  };
}

export class AccountService {
  constructor(
    private readonly repos: Repositories,
    private readonly chain: ChainReader,
    private readonly network: 'testnet' | 'mainnet',
    private readonly logger: Logger,
    private readonly now: () => Date,
  ) {}

  /**
   * Registers an account the caller owns. Ownership is read from the contract itself
   * (`owner()`, `agent()` and `policy()`), so nobody can register, and then read the approvals of, an
   * account they do not control.
   */
  async register(
    ownerPublicKey: string,
    input: { contractId: string; label: string; agentPublicKey?: string; network?: string },
  ) {
    if (input.network && input.network !== this.network) {
      throw badRequest(`This API serves ${this.network}; the account is on ${input.network}`);
    }
    let keys;
    try {
      keys = await this.chain.getAccountInfo(input.contractId);
    } catch (err) {
      this.logger.warn('account owner lookup failed', { contractId: input.contractId, err });
      throw new ApiError(
        502,
        'chain_unavailable',
        'Could not read owner(), agent() and policy() from the contract. Check the contract ID and network.',
      );
    }
    if (keys.owner !== ownerPublicKey) {
      throw forbidden('The signed-in key is not the owner of this account contract');
    }
    if (input.agentPublicKey && input.agentPublicKey !== keys.agent) {
      throw badRequest('agentPublicKey does not match the agent() key stored in the contract');
    }
    const { apiKey, apiKeyId, apiKeyHash } = AuthService.generateApiKey();
    const account: StoredAccount = {
      contractId: input.contractId,
      ownerPublicKey,
      agentPublicKey: keys.agent,
      token: keys.token,
      label: input.label,
      network: this.network,
      createdAt: this.now().toISOString(),
      apiKeyId,
      apiKeyHash,
    };
    try {
      await this.repos.accounts.create(account);
    } catch (err) {
      if (err instanceof DuplicateError) throw conflict('Account is already registered');
      throw err;
    }
    this.logger.info('account registered', { contractId: account.contractId });
    return { account: toPublicAccount(account), apiKey };
  }

  async list(ownerPublicKey: string): Promise<AgentAccount[]> {
    return (await this.repos.accounts.listByOwner(ownerPublicKey)).map(toPublicAccount);
  }

  /** Loads an account the principal may read: the owner's own accounts, or the agent's own. */
  async requireReadable(principal: Principal, contractId: string): Promise<StoredAccount> {
    if (principal.kind === 'agent') {
      if (principal.contractId !== contractId) throw notFound('Account not found');
      return principal.account;
    }
    const account = await this.repos.accounts.findByContractId(contractId);
    if (!account || account.ownerPublicKey !== principal.publicKey) {
      throw notFound('Account not found');
    }
    return account;
  }

  async payments(
    principal: Principal,
    contractId: string,
    limit: number,
  ): Promise<PaymentRecord[]> {
    await this.requireReadable(principal, contractId);
    return this.repos.payments.listByContract(contractId, limit);
  }
}
