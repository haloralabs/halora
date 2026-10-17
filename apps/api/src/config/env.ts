import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  HALORA_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_RPC_URL: z.string().url().optional(),
  /** Domain bound into owner login challenges so a signature cannot be replayed elsewhere. */
  AUTH_DOMAIN: z.string().min(1).default('localhost'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),
  CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
  APPROVAL_DEFAULT_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  /** Only enable behind a trusted reverse proxy that overwrites X-Forwarded-For. */
  TRUST_PROXY: bool.default(false),
  INDEXER_ENABLED: bool.default(true),
  INDEXER_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  EXPIRY_INTERVAL_MS: z.coerce.number().int().min(1000).default(15000),
});

export type Env = z.infer<typeof EnvSchema>;

export const DEFAULT_RPC_URLS: Record<Env['HALORA_NETWORK'], string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  // Mainnet has no SDF-operated public RPC; operators must set STELLAR_RPC_URL explicitly.
  mainnet: '',
};

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Only variable names and messages are reported, never values.
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n  ${problems.join('\n  ')}`);
  }
  return parsed.data;
}

export function resolveRpcUrl(env: Env): string {
  const url = env.STELLAR_RPC_URL ?? DEFAULT_RPC_URLS[env.HALORA_NETWORK];
  if (!url) throw new Error('STELLAR_RPC_URL is required for mainnet');
  return url;
}
