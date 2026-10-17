import { z } from 'zod';
import {
  AgentAccountSchema,
  ApprovalRequestSchema,
  PaymentRecordSchema,
  type ApprovalStatus,
} from '@/lib/domain';
import { DataServiceError, type OwnerSession } from '../types';

/**
 * Typed client for the Halora API (docs/architecture/interfaces.md section 3). Every response is
 * validated with zod; anything unexpected is treated as an error rather than rendered.
 */
export class HaloraApiClient {
  private token: { value: string; publicKey: string } | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = (
      input,
      init,
    ) => fetch(input, init),
  ) {}

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit & { auth?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    if (init.auth !== false && this.token)
      headers.set('Authorization', `Bearer ${this.token.value}`);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers });
    } catch {
      throw new DataServiceError('The Halora API could not be reached.', 'network');
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
          ? body.message
          : `Request failed with status ${res.status}.`;
      const code =
        res.status === 401 || res.status === 403
          ? 'unauthorized'
          : res.status === 404
            ? 'not_found'
            : res.status === 409
              ? 'conflict'
              : 'invalid';
      throw new DataServiceError(message, code);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new DataServiceError('The Halora API returned an unexpected response.', 'invalid');
    return parsed.data;
  }

  /**
   * Owner challenge-response login. Assumed shape (not yet fixed in interfaces.md):
   * challenge `{ publicKey }` returns `{ challenge }`; the owner wallet signs it with SEP-43
   * `signMessage`; verify `{ publicKey, challenge, signature }` returns `{ token }`.
   */
  async ensureSession(owner: OwnerSession): Promise<void> {
    if (this.token?.publicKey === owner.publicKey) return;
    const { challenge } = await this.request(
      '/v1/auth/challenge',
      z.object({ challenge: z.string() }),
      {
        method: 'POST',
        body: JSON.stringify({ publicKey: owner.publicKey }),
        auth: false,
      },
    );
    const signature = await owner.wallet.signMessage(challenge, owner.publicKey);
    const { token } = await this.request('/v1/auth/verify', z.object({ token: z.string() }), {
      method: 'POST',
      body: JSON.stringify({ publicKey: owner.publicKey, challenge, signature }),
      auth: false,
    });
    this.token = { value: token, publicKey: owner.publicKey };
  }

  listAccounts() {
    return this.request('/v1/accounts', z.object({ accounts: z.array(AgentAccountSchema) }));
  }

  registerAccount(body: {
    label: string;
    contractId: string;
    agentPublicKey: string;
    network: string;
  }) {
    return this.request(
      '/v1/accounts',
      z.object({ account: AgentAccountSchema, apiKey: z.string() }),
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  rotateApiKey(contractId: string) {
    return this.request(
      `/v1/accounts/${encodeURIComponent(contractId)}/api-key`,
      z.object({ apiKey: z.string() }),
      {
        method: 'POST',
      },
    );
  }

  listPayments(contractId: string, limit = 100) {
    return this.request(
      `/v1/accounts/${encodeURIComponent(contractId)}/payments?limit=${limit}`,
      z.object({ payments: z.array(PaymentRecordSchema) }),
    );
  }

  listApprovals(query: { contractId?: string; status?: ApprovalStatus }) {
    const params = new URLSearchParams();
    if (query.contractId) params.set('contractId', query.contractId);
    if (query.status) params.set('status', query.status);
    const qs = params.toString();
    return this.request(
      `/v1/approvals${qs ? `?${qs}` : ''}`,
      z.object({ approvals: z.array(ApprovalRequestSchema) }),
    );
  }

  getApproval(id: string) {
    return this.request(
      `/v1/approvals/${encodeURIComponent(id)}`,
      z.object({ approval: ApprovalRequestSchema }),
    );
  }

  approve(id: string, approvalTxHash: string) {
    return this.request(
      `/v1/approvals/${encodeURIComponent(id)}/approve`,
      z.object({ approval: ApprovalRequestSchema }),
      {
        method: 'POST',
        body: JSON.stringify({ approvalTxHash }),
      },
    );
  }

  reject(id: string, reason?: string) {
    return this.request(
      `/v1/approvals/${encodeURIComponent(id)}/reject`,
      z.object({ approval: ApprovalRequestSchema }),
      {
        method: 'POST',
        body: JSON.stringify(reason ? { reason } : {}),
      },
    );
  }
}
