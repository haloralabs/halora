/**
 * Integration snippets shown on the landing page and the per-agent "Connect your agent" page.
 * They follow the SDK and MCP surface in docs/architecture/interfaces.md sections 4 and 5.
 * Secrets are always referenced through environment variables, never inlined.
 */

export type SnippetParams = {
  contractId: string;
  network: 'testnet' | 'mainnet';
  apiUrl: string;
};

export const PLACEHOLDER: SnippetParams = {
  contractId: 'C...YOUR_AGENT_ACCOUNT',
  network: 'testnet',
  apiUrl: 'https://api.halora.dev',
};

export function installSnippet(): string {
  return 'bun add @halora/sdk';
}

export function sdkSnippet(p: SnippetParams): string {
  return `import { HaloraAgent } from '@halora/sdk';

const agent = new HaloraAgent({
  contractId: '${p.contractId}',
  agentSecret: process.env.HALORA_AGENT_SECRET!,
  network: '${p.network}',
  apiUrl: '${p.apiUrl}',
  apiKey: process.env.HALORA_API_KEY,
});

// Pays on HTTP 402 within the policy, then retries the request.
const res = await agent.fetch('https://api.example.com/v1/report');

// Direct payment. Above the approval threshold it waits for the owner.
const result = await agent.pay({
  to: 'G...RECIPIENT',
  amount: 2_500_000n, // 0.25 USDC (7 decimals)
  reason: 'Weather data for the trip planner',
});`;
}

export function mcpSnippet(p: SnippetParams): string {
  return JSON.stringify(
    {
      mcpServers: {
        halora: {
          command: 'bunx',
          args: ['@halora/mcp'],
          env: {
            HALORA_CONTRACT_ID: p.contractId,
            HALORA_AGENT_SECRET: '<agent secret, from your secret manager>',
            HALORA_NETWORK: p.network,
            HALORA_API_URL: p.apiUrl,
            HALORA_API_KEY: '<api key>',
          },
        },
      },
    },
    null,
    2,
  );
}

export function envSnippet(p: SnippetParams, apiKey?: string): string {
  return [
    `HALORA_CONTRACT_ID=${p.contractId}`,
    'HALORA_AGENT_SECRET=S...  # keep in a secret manager, never commit',
    `HALORA_NETWORK=${p.network}`,
    `HALORA_API_URL=${p.apiUrl}`,
    `HALORA_API_KEY=${apiKey ?? 'hal_...'}`,
  ].join('\n');
}

export const MCP_TOOLS: Array<{ name: string; description: string }> = [
  { name: 'halora_status', description: 'Balance, policy, spent today and what remains.' },
  {
    name: 'halora_pay',
    description: 'Pay a recipient within policy, or open an approval request.',
  },
  { name: 'halora_fetch_paid', description: 'Fetch a URL and settle x402 payments within policy.' },
  { name: 'halora_approval_status', description: 'Check whether the owner approved a request.' },
  { name: 'halora_recent_payments', description: 'List recent payments from this account.' },
];
