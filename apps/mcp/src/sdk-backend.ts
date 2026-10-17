import { HaloraAgent, HaloraApiClient, isHaloraPolicyError } from '@halora/sdk';
import {
  PolicyRefusal,
  type ApprovalInfo,
  type FetchOutcome,
  type PayOutcome,
  type PaymentRecordView,
  type WalletBackend,
  type WalletStatus,
} from './backend';
import type { McpConfig } from './config';

type X402Payment = NonNullable<FetchOutcome['payment']>;

/** Maps SDK policy errors to PolicyRefusal so the tool layer can tell the model it is final. */
function mapError(err: unknown): never {
  if (isHaloraPolicyError(err)) throw new PolicyRefusal(err.code, err.message);
  if (err instanceof Error && err.name === 'X402Error') {
    throw new PolicyRefusal('X402Refused', err.message);
  }
  throw err;
}

/**
 * WalletBackend backed by @halora/sdk `HaloraAgent`. The agent secret is handed to the SDK once
 * and is not kept anywhere else in this object.
 */
export class SdkWalletBackend implements WalletBackend {
  private readonly agent: HaloraAgent;
  private readonly api?: HaloraApiClient;
  private readonly apiUrl?: string;
  private readonly apiKey?: string;
  private readonly contractId: string;
  private readonly network: 'testnet' | 'mainnet';
  /** x402 payments observed per URL, consumed by the fetchPaid call that triggered them. */
  private readonly x402Payments = new Map<string, X402Payment[]>();

  constructor(config: McpConfig) {
    this.contractId = config.contractId;
    this.network = config.network;
    this.agent = new HaloraAgent({
      contractId: config.contractId,
      agentSecret: config.agentSecret,
      network: config.network,
      rpcUrl: config.rpcUrl,
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      onX402Payment: ({ url, requirement }) => {
        const list = this.x402Payments.get(url) ?? [];
        list.push({
          amount: String(requirement.amount),
          to: String(requirement.payTo),
          asset: String(requirement.asset),
          network: String(requirement.network),
        });
        this.x402Payments.set(url, list);
      },
    });
    if (config.apiUrl && config.apiKey) {
      this.api = new HaloraApiClient({ apiUrl: config.apiUrl, apiKey: config.apiKey });
      this.apiUrl = config.apiUrl.replace(/\/+$/, '');
      this.apiKey = config.apiKey;
    }
  }

  async status(): Promise<WalletStatus> {
    const views = this.agent.views;
    const policy = await views.getPolicy(this.contractId);
    const [balance, spentToday] = await Promise.all([
      views.getBalance(this.contractId, policy.token),
      views.getSpentToday(this.contractId),
    ]);
    return {
      contractId: this.contractId,
      network: this.network,
      balance: balance.toString(),
      policy,
      spentToday: spentToday.toString(),
    };
  }

  async pay(input: { to: string; amount: bigint; reason: string }): Promise<PayOutcome> {
    try {
      const r = await this.agent.pay(input);
      if (r.status === 'paid') {
        return { status: 'paid', txHash: r.txHash, amount: r.amount, to: r.to };
      }
      return {
        status: 'approval_pending',
        approvalId: r.approvalId,
        amount: r.amount,
        to: r.to,
        expiresAt: r.expiresAt,
      };
    } catch (err) {
      mapError(err);
    }
  }

  async fetchPaid(input: { url: string; method: string; body?: string }): Promise<FetchOutcome> {
    try {
      const res = await this.agent.fetch(input.url, {
        method: input.method,
        ...(input.body !== undefined ? { body: input.body } : {}),
      });
      const payment = this.x402Payments.get(input.url)?.shift();
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        body: await res.text(),
        ...(payment ? { payment } : {}),
      };
    } catch (err) {
      mapError(err);
    }
  }

  async approvalStatus(id: string): Promise<ApprovalInfo> {
    if (!this.api) throw new Error('Approvals need HALORA_API_URL and HALORA_API_KEY');
    const a = await this.api.getApproval(id);
    return {
      id: a.id,
      status: a.status,
      to: a.to,
      amount: a.amount,
      reason: a.reason,
      expiresAt: a.expiresAt,
    };
  }

  /**
   * LOCAL ADAPTER: @halora/sdk's HaloraApiClient has no payment-log method yet, so this calls
   * GET /v1/accounts/:contractId/payments directly with the agent API key.
   */
  async recentPayments(limit: number): Promise<PaymentRecordView[]> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('The payment log needs HALORA_API_URL and HALORA_API_KEY');
    }
    const res = await fetch(
      `${this.apiUrl}/v1/accounts/${encodeURIComponent(this.contractId)}/payments?limit=${limit}`,
      { headers: { authorization: `Bearer ${this.apiKey}`, accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`Halora API returned ${res.status} for the payment log`);
    const json = (await res.json()) as { payments?: PaymentRecordView[] };
    if (!Array.isArray(json.payments)) throw new Error('Unexpected payment log response');
    return json.payments.map((p) => ({
      id: p.id,
      to: p.to,
      amount: p.amount,
      token: p.token,
      txHash: p.txHash,
      ledger: p.ledger,
      createdAt: p.createdAt,
      source: p.source,
      ...(p.resource ? { resource: p.resource } : {}),
    }));
  }
}
