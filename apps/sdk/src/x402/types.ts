/**
 * x402 v2 message schemas (HTTP transport), from the x402 specification:
 * https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
 * https://github.com/coinbase/x402/blob/main/specs/transports-v2/http.md
 * https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_stellar.md
 *
 * Schemas are intentionally permissive about unknown fields (servers may add extensions) but
 * strict about the fields we act on.
 */

import { z } from 'zod';

export const X402_VERSION = 2;

export const ResourceInfoSchema = z.looseObject({
  url: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});
export type ResourceInfo = z.infer<typeof ResourceInfoSchema>;

export const PaymentRequirementsSchema = z.looseObject({
  scheme: z.string(),
  network: z.string(),
  /** Atomic units as an integer string. */
  amount: z.string().regex(/^(0|[1-9][0-9]*)$/),
  asset: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z.record(z.string(), z.unknown()).optional(),
});
export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;

export const PaymentRequiredSchema = z.looseObject({
  x402Version: z.number().int(),
  error: z.string().optional(),
  resource: ResourceInfoSchema.optional(),
  accepts: z.array(z.unknown()),
  extensions: z.record(z.string(), z.unknown()).optional(),
});
export type PaymentRequired = z.infer<typeof PaymentRequiredSchema>;

export type PaymentPayload = {
  x402Version: number;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};

export const SettlementResponseSchema = z.looseObject({
  success: z.boolean(),
  errorReason: z.string().optional(),
  transaction: z.string(),
  network: z.string(),
  payer: z.string().optional(),
});
export type SettlementResponse = z.infer<typeof SettlementResponseSchema>;

/**
 * Pluggable payment scheme. `HaloraAgent` provides the Stellar `exact` implementation that
 * produces `HaloraSignature` credentials; other schemes can be added without touching fetch.
 */
export interface X402PaymentSigner {
  /** Picks the requirement this signer can pay, or undefined if none is acceptable. */
  select(
    accepts: PaymentRequirements[],
  ): PaymentRequirements | undefined | Promise<PaymentRequirements | undefined>;
  /** Builds the scheme-specific `payload` object for the chosen requirement. */
  createPayload(
    requirement: PaymentRequirements,
    resource: ResourceInfo | undefined,
  ): Promise<Record<string, unknown>>;
}
