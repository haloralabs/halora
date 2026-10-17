/**
 * x402-aware fetch. On HTTP 402 with a v2 `PAYMENT-REQUIRED` header it asks the signer for a
 * payment, retries once with `PAYMENT-SIGNATURE`, and returns the second response. It never
 * pays more than once per call, and never pays when the request body cannot be replayed.
 */

import type { FetchLike } from '../api.js';
import { encodePaymentPayload, parsePaymentRequired, PAYMENT_SIGNATURE_HEADER } from './http.js';
import { X402_VERSION, type PaymentRequirements, type X402PaymentSigner } from './types.js';

export class X402Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'X402Error';
  }
}

export type X402PaymentEvent = {
  url: string;
  requirement: PaymentRequirements;
  response: Response;
};

export type X402FetchOptions = {
  fetch?: FetchLike;
  signer: X402PaymentSigner;
  /** Called after the paid retry completes (for logging payments, never secrets). */
  onPayment?: (event: X402PaymentEvent) => void | Promise<void>;
};

function isReplayableBody(body: RequestInit['body']): boolean {
  return !(typeof ReadableStream !== 'undefined' && body instanceof ReadableStream);
}

export function createX402Fetch(opts: X402FetchOptions) {
  const baseFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  return async function x402Fetch(input: string | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    const first = await baseFetch(url, init);
    if (first.status !== 402) return first;

    const parsed = parsePaymentRequired(first);
    if (!parsed) return first; // Not an x402 v2 response we understand; surface it unchanged.
    if (parsed.required.x402Version !== X402_VERSION) {
      throw new X402Error(`unsupported x402 version ${parsed.required.x402Version}`);
    }
    if (!isReplayableBody(init?.body)) {
      throw new X402Error('cannot pay for a request with a streaming body (it cannot be replayed)');
    }
    const requirement = await opts.signer.select(parsed.accepts);
    if (!requirement) {
      throw new X402Error('no acceptable x402 payment option (scheme, network or asset mismatch)');
    }
    const payload = await opts.signer.createPayload(requirement, parsed.required.resource);
    const headers = new Headers(init?.headers);
    headers.set(
      PAYMENT_SIGNATURE_HEADER,
      encodePaymentPayload({
        x402Version: X402_VERSION,
        resource: parsed.required.resource,
        accepted: requirement,
        payload,
        ...(parsed.required.extensions ? { extensions: parsed.required.extensions } : {}),
      }),
    );
    const second = await baseFetch(url, { ...init, headers });
    if (opts.onPayment) await opts.onPayment({ url, requirement, response: second });
    return second;
  };
}
