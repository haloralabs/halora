#!/usr/bin/env bun
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config';
import { scrub } from './redact';
import { SdkWalletBackend } from './sdk-backend';
import { createServer } from './server';

// stdout carries the MCP protocol; diagnostics go to stderr only, and are scrubbed.
const log = (msg: string, secrets: string[] = []) =>
  process.stderr.write(`${scrub(msg, secrets)}\n`);

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    log(err instanceof Error ? err.message : 'Invalid configuration');
    process.exit(1);
  }
  const secrets = [config.agentSecret, config.apiKey ?? ''];
  const backend = new SdkWalletBackend(config);
  const server = createServer(backend, { secrets });
  await server.connect(new StdioServerTransport());
  log(`halora-mcp ready (network ${config.network}, account ${config.contractId})`);
}

main().catch((err) => {
  log(`halora-mcp failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
