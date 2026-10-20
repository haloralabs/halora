/* eslint-disable no-console -- a command-line script: console output is its interface */

/**
 * Testnet smoke test for @halora/mcp (HAL-013): starts the real MCP server over stdio, the way
 * Claude Code or Claude Desktop would, and calls its tools against a live halora-account.
 *
 * Usage (from the repo root):
 *   HALORA_AGENT_SECRET=$(stellar keys show halora-agent) \
 *   HALORA_CONTRACT_ID=C... HALORA_MERCHANT=G... \
 *   bun apps/mcp/scripts/testnet-smoke.ts
 *
 * Amounts are token base units (7 decimals), as the halora_pay tool requires.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`missing environment variable ${name}`);
  return v.trim();
};

const merchant = env('HALORA_MERCHANT');
const transport = new StdioClientTransport({
  command: 'bun',
  args: ['run', new URL('../src/index.ts', import.meta.url).pathname],
  env: {
    PATH: process.env.PATH ?? '',
    HALORA_CONTRACT_ID: env('HALORA_CONTRACT_ID'),
    HALORA_AGENT_SECRET: env('HALORA_AGENT_SECRET'),
    HALORA_NETWORK: 'testnet',
  },
});
const client = new Client({ name: 'halora-testnet-smoke', version: '0.1.0' });

function text(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content
    .map((c) => c.text ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 400);
}

async function main() {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log('[tools]', tools.map((t) => t.name).join(', '));

  const status = await client.callTool({ name: 'halora_status', arguments: {} });
  console.log('[halora_status]', text(status));

  const pay = await client.callTool({
    name: 'halora_pay',
    arguments: {
      to: merchant,
      amount: '2000000',
      reason: 'MCP smoke test within policy (0.2 XLM)',
    },
  });
  console.log('[halora_pay 0.2 XLM]', pay.isError ? 'ERROR' : 'OK', text(pay));

  const over = await client.callTool({
    name: 'halora_pay',
    arguments: {
      to: merchant,
      amount: '90000000',
      reason: 'MCP smoke test above the per payment limit (9 XLM)',
    },
  });
  console.log('[halora_pay 9 XLM]', over.isError ? 'REFUSED' : 'UNEXPECTED OK', text(over));
  if (!over.isError || pay.isError) process.exitCode = 1;

  // The agent secret must never appear in any tool output.
  const secret = env('HALORA_AGENT_SECRET');
  const leaked = [status, pay, over].some((r) => JSON.stringify(r).includes(secret));
  console.log('[secret-redaction]', leaked ? 'LEAKED' : 'OK');
  if (leaked) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[failed]', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => client.close());
