/** x402 v2 HTTP transport header names and base64 JSON codecs. */

import {
  PaymentRequiredSchema,
  PaymentRequirementsSchema,
  SettlementResponseSchema,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type SettlementResponse,
} from './types.js';

export const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
export const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE';
export const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE';

export function encodeBase64Json(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeBase64Json(value: string): unknown {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/**
 * Parses the `PAYMENT-REQUIRED` header of a 402 response. Returns the payment-required object
 * plus the requirements entries that parsed cleanly (malformed entries are skipped).
 */
export function parsePaymentRequired(
  res: Response,
): { required: PaymentRequired; accepts: PaymentRequirements[] } | null {
  const header = res.headers.get(PAYMENT_REQUIRED_HEADER);
  if (!header) return null;
  let decoded: unknown;
  try {
    decoded = decodeBase64Json(header);
  } catch {
    return null;
  }
  const parsed = PaymentRequiredSchema.safeParse(decoded);
  if (!parsed.success) return null;
  const accepts: PaymentRequirements[] = [];
  for (const item of parsed.data.accepts) {
    const r = PaymentRequirementsSchema.safeParse(item);
    if (r.success) accepts.push(r.data);
  }
  return { required: parsed.data, accepts };
}

export function encodePaymentPayload(payload: PaymentPayload): string {
  return encodeBase64Json(payload);
}

/** Parses the `PAYMENT-RESPONSE` settlement header, or null when absent or malformed. */
export function parsePaymentResponse(res: Response): SettlementResponse | null {
  const header = res.headers.get(PAYMENT_RESPONSE_HEADER);
  if (!header) return null;
  try {
    const parsed = SettlementResponseSchema.safeParse(decodeBase64Json(header));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
