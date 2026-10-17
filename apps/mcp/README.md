# @halora/mcp

MCP server (stdio) that gives an MCP-capable agent a Halora wallet: a Stellar smart account whose spending policy (per-payment limit, daily limit, optional recipient allowlist, approval threshold, expiry, pause) is enforced on-chain by the account contract. The server is a thin layer over `HaloraAgent` from `@halora/sdk`; even if this server or the agent is compromised, the contract still refuses payments outside the policy.

Built on the official TypeScript SDK `@modelcontextprotocol/sdk` 1.32 (`McpServer` + `StdioServerTransport`).

## Tools

| Tool                     | Input                     | What it does                                                                                     |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `halora_status`          | none                      | Balance, policy, spent today (UTC) and remaining daily budget. Read-only.                        |
| `halora_pay`             | `to`, `amount`, `reason`  | Pays from the wallet. Returns `paid`, `approval_pending` with an id, or a refusal.               |
| `halora_fetch_paid`      | `url`, `method?`, `body?` | HTTP request; on 402 (x402) pays within policy and retries once. Body capped at 100k characters. |
| `halora_approval_status` | `id`                      | Status of an approval request (pending, approved, rejected, expired, submitted).                 |
| `halora_recent_payments` | `limit?`                  | Recent payments, indexed by the Halora API from on-chain token transfer events.                  |

Amounts are integer strings in the token base unit (USDC has 7 decimals: `"10000000"` is 1 USDC).

Every tool description tells the calling model the limits it operates under, and policy refusals come back as `isError` results that say the refusal is a policy decision by the owner and must not be retried or worked around.

### Approval flow

1. `halora_pay` above the approval threshold returns `approval_pending` with an `approvalId`.
2. The owner approves in the dashboard, which submits `approve_payment` on-chain.
3. `halora_approval_status` shows `approved`; the agent calls `halora_pay` again with the same recipient and amount, which consumes the on-chain approval.

## Configuration

| Variable              | Required | Notes                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `HALORA_CONTRACT_ID`  | yes      | The agent account contract (`C...`).                                  |
| `HALORA_AGENT_SECRET` | yes      | Agent key secret seed (`S...`). Never returned by any tool or logged. |
| `HALORA_NETWORK`      | no       | `testnet` (default) or `mainnet`.                                     |
| `HALORA_API_URL`      | no       | Halora API base URL. Needed for approvals and the payment log.        |
| `HALORA_API_KEY`      | no       | Agent API key from account registration. Set together with the URL.   |
| `HALORA_RPC_URL`      | no       | Stellar RPC URL. Required on mainnet (there is no default there).     |

The agent secret limits damage rather than preventing it: if it leaks, the holder can spend up to the policy, and no more. Store it like any other secret, rotate it with `set_agent` if exposed, and use testnet keys while evaluating.

## Use with Claude Code

```bash
claude mcp add halora \
  --env HALORA_CONTRACT_ID=C... \
  --env HALORA_AGENT_SECRET=S... \
  --env HALORA_NETWORK=testnet \
  --env HALORA_API_URL=https://api.example.com \
  --env HALORA_API_KEY=hak_... \
  -- bun /absolute/path/to/halora/apps/mcp/src/index.ts
```

## Use with Claude Desktop

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`). This file stores the values in plain text, so keep it private and use a testnet key unless you accept that risk.

```json
{
  "mcpServers": {
    "halora": {
      "command": "bun",
      "args": ["/absolute/path/to/halora/apps/mcp/src/index.ts"],
      "env": {
        "HALORA_CONTRACT_ID": "C...",
        "HALORA_AGENT_SECRET": "S...",
        "HALORA_NETWORK": "testnet",
        "HALORA_API_URL": "https://api.example.com",
        "HALORA_API_KEY": "hak_..."
      }
    }
  }
}
```

## Development

```bash
bun run dev        # watch mode (stdio)
bun test           # tools tested against a mocked wallet backend, no network
bun run lint
bun run typecheck
bun run build      # dist/index.js
```

stdout carries the MCP protocol, so the server writes diagnostics to stderr only, and `no-console` is enforced by lint.
