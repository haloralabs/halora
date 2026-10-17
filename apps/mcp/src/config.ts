import { z } from 'zod';

const ConfigSchema = z.object({
  HALORA_CONTRACT_ID: z.string().regex(/^C[A-Z2-7]{55}$/, 'must be a contract (C...) address'),
  HALORA_AGENT_SECRET: z.string().regex(/^S[A-Z2-7]{55}$/, 'must be a Stellar secret seed'),
  HALORA_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  HALORA_API_URL: z.string().url().optional(),
  HALORA_API_KEY: z.string().min(1).optional(),
  HALORA_RPC_URL: z.string().url().optional(),
});

export type McpConfig = {
  contractId: string;
  agentSecret: string;
  network: 'testnet' | 'mainnet';
  apiUrl?: string;
  apiKey?: string;
  rpcUrl?: string;
};

/**
 * Reads configuration from the environment. Error messages name the variable and the rule,
 * never the value, so a malformed secret is not echoed to logs.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): McpConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid Halora MCP configuration:\n  ${problems.join('\n  ')}`);
  }
  const e = parsed.data;
  if (Boolean(e.HALORA_API_URL) !== Boolean(e.HALORA_API_KEY)) {
    throw new Error('HALORA_API_URL and HALORA_API_KEY must be set together');
  }
  return {
    contractId: e.HALORA_CONTRACT_ID,
    agentSecret: e.HALORA_AGENT_SECRET,
    network: e.HALORA_NETWORK,
    apiUrl: e.HALORA_API_URL,
    apiKey: e.HALORA_API_KEY,
    rpcUrl: e.HALORA_RPC_URL,
  };
}
