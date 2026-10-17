import { z } from 'zod';

const ConfigSchema = z.object({
  dataMode: z.enum(['mock', 'live']).default('mock'),
  network: z.enum(['testnet', 'mainnet']).default('testnet'),
  apiUrl: z.string().url().default('http://localhost:3001'),
  rpcUrl: z.string().url().default('https://soroban-testnet.stellar.org'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Public runtime configuration. NEXT_PUBLIC_ variables must be referenced literally so Next
 * can inline them at build time. Invalid values fall back to safe defaults (mock mode).
 */
export function readConfig(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_HALORA_DATA_MODE: process.env.NEXT_PUBLIC_HALORA_DATA_MODE,
    NEXT_PUBLIC_HALORA_NETWORK: process.env.NEXT_PUBLIC_HALORA_NETWORK,
    NEXT_PUBLIC_HALORA_API_URL: process.env.NEXT_PUBLIC_HALORA_API_URL,
    NEXT_PUBLIC_HALORA_RPC_URL: process.env.NEXT_PUBLIC_HALORA_RPC_URL,
  },
): AppConfig {
  const parsed = ConfigSchema.safeParse({
    dataMode: env.NEXT_PUBLIC_HALORA_DATA_MODE || undefined,
    network: env.NEXT_PUBLIC_HALORA_NETWORK || undefined,
    apiUrl: env.NEXT_PUBLIC_HALORA_API_URL || undefined,
    rpcUrl: env.NEXT_PUBLIC_HALORA_RPC_URL || undefined,
  });
  return parsed.success ? parsed.data : ConfigSchema.parse({});
}

export const config = readConfig();
