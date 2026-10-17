/**
 * Minimal client for the agent-facing Halora API routes (interfaces.md section 3).
 * Responses are validated with the shared zod schemas; anything unexpected is an error.
 */

import {
  API_BASE_PATH,
  ApprovalRequestSchema,
  CreateApprovalBodySchema,
  type ApprovalRequest,
  type CreateApprovalBody,
} from '@halora/shared';
import { HaloraApiError, HaloraSdkError } from './errors.js';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type HaloraApiClientOptions = {
  apiUrl: string;
  apiKey: string;
  fetch?: FetchLike;
};

/** Rejects plain HTTP except for local development hosts, so API keys never travel in clear. */
export function assertSecureUrl(url: string, what: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HaloraSdkError(`${what} is not a valid URL`);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
    throw new HaloraSdkError(`${what} must use https`);
  }
  return parsed;
}

export class HaloraApiClient {
  private readonly base: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: HaloraApiClientOptions) {
    const url = assertSecureUrl(opts.apiUrl, 'apiUrl');
    this.base = url.toString().replace(/\/+$/, '');
    if (!opts.apiKey) throw new HaloraSdkError('apiKey is required');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  async createApproval(body: CreateApprovalBody): Promise<ApprovalRequest> {
    const payload = CreateApprovalBodySchema.parse(body);
    const res = await this.request('POST', `${API_BASE_PATH}/approvals`, payload);
    return ApprovalRequestSchema.parse(res);
  }

  async getApproval(id: string): Promise<ApprovalRequest> {
    const res = await this.request('GET', `${API_BASE_PATH}/approvals/${encodeURIComponent(id)}`);
    return ApprovalRequestSchema.parse(res);
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.apiKey}`,
      accept: 'application/json',
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      // Never echo request headers (they carry the API key); only status and a short body.
      throw new HaloraApiError(
        `Halora API ${method} ${path} failed with ${res.status}: ${text.slice(0, 300)}`,
        res.status,
      );
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new HaloraApiError(`Halora API ${method} ${path} returned invalid JSON`, res.status);
    }
  }
}
