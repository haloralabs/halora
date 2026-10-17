import { StrKey } from '@stellar/stellar-sdk';
import { z } from 'zod';

/** Request validation schemas. Amounts are base-unit integer strings, never JS numbers. */

export const accountAddress = z
  .string()
  .refine((v) => StrKey.isValidEd25519PublicKey(v), 'must be a Stellar account (G...) address');

export const contractAddress = z
  .string()
  .refine((v) => StrKey.isValidContract(v), 'must be a Stellar contract (C...) address');

export const anyAddress = z
  .string()
  .refine(
    (v) => StrKey.isValidEd25519PublicKey(v) || StrKey.isValidContract(v),
    'must be a Stellar G... or C... address',
  );

// i128 max is about 1.7e38 (39 digits).
export const amountString = z
  .string()
  .regex(/^[1-9][0-9]{0,38}$/, 'must be a positive integer string in token base units');

const base64 = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be base64');

export const approvalStatus = z.enum(['pending', 'approved', 'rejected', 'expired', 'submitted']);

export const ChallengeBody = z.object({ publicKey: accountAddress }).strict();

export const VerifyBody = z
  .object({
    publicKey: accountAddress,
    nonce: z.string().regex(/^[0-9a-f]{32}$/, 'invalid nonce'),
    signature: base64.max(200),
  })
  .strict();

export const RegisterAccountBody = z
  .object({
    contractId: contractAddress,
    label: z.string().trim().min(1).max(100),
    // Optional assertions (sent by clients using the shared RegisterAccountBodySchema). The
    // authoritative values are read from the contract; a mismatch is rejected.
    agentPublicKey: accountAddress.optional(),
    network: z.enum(['testnet', 'mainnet']).optional(),
  })
  .strict();

export const PaymentsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const CreateApprovalBody = z
  .object({
    contractId: contractAddress,
    token: contractAddress,
    to: anyAddress,
    amount: amountString,
    // May be empty (the SDK sends '' when the caller gave no reason); the owner sees that.
    reason: z.string().trim().max(500),
    expiresInSeconds: z.number().int().min(60).max(86_400).optional(),
  })
  .strict();

export const ListApprovalsQuery = z.object({
  contractId: contractAddress.optional(),
  status: approvalStatus.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ApproveBody = z
  .object({
    approvalTxHash: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'must be a 64-character hex transaction hash')
      .transform((v) => v.toLowerCase()),
  })
  .strict();

export const RejectBody = z.object({ reason: z.string().trim().max(500).optional() }).strict();

export const IdParam = z.object({ id: z.string().uuid() });
export const ContractIdParam = z.object({ contractId: contractAddress });
