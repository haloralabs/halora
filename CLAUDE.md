# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

Halora gives AI agents a Stellar wallet with rules they cannot break. An owner funds a Soroban smart account, sets a policy (per-payment limit, daily limit, allowed recipients, approval threshold, expiry), and hands the agent a key. The agent pays for APIs and services on its own (including x402 pay-per-request), and every payment is checked on-chain by the account contract, so a manipulated or buggy agent can never spend more than its owner allowed.

**The canonical source of product direction is [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md).** The canonical source of cross-workspace interfaces (contract methods, errors, shared types, API routes, MCP tools) is [`docs/architecture/interfaces.md`](docs/architecture/interfaces.md). Where anything else in this repo disagrees, those two files win. If you need to change an interface, update `interfaces.md` in the same change.

## Non-negotiables

- **Quality and professionalism come first.** This project is pitched to grant reviewers (Stellar Community Fund), developers and companies. Every artifact must read as something a skeptical reviewer could be handed directly.
- **Never use an em dash, anywhere.** Use a comma, a period, a colon, or parentheses instead.
- **No emojis, ever** in code, commits, PRs, or documentation. Icons in the UI are fine: `apps/webapp` uses `lucide-react` exclusively.
- **Security first.** This product holds money. Fail closed: when a policy check cannot be evaluated, deny. Never log or commit secret keys. Testnet keys only, never committed.
- **Honest claims.** Say "enforced on-chain by the account contract", never "trustless" or "unhackable". Mark unverified external facts (x402 on Stellar details, protocol upgrade status) as unverified in docs.
- **Follow the documentation, don't improvise around it.** If a change contradicts what's documented, update the documentation in the same change.
- **Checks must pass before any work is considered done.** Do not say something is finished unless you ran the relevant checks and saw them pass.

## Architecture

Bun monorepo with five TypeScript workspaces plus a Rust contracts workspace built separately:

| Path             | Package          | Role                                                                                                     |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/contracts` | (Rust, not bun)  | Soroban contracts. `halora-account`: custom account that enforces the spending policy in `__check_auth`. |
| `apps/shared`    | `@halora/shared` | Types, zod schemas, constants, contract-ID JSON, shared by every TS workspace.                           |
| `apps/sdk`       | `@halora/sdk`    | Public TypeScript SDK: deploy/configure accounts, sign agent payments, x402 client, approval requests.   |
| `apps/api`       | `@halora/api`    | Elysia on Bun: approval queue, payment indexing from contract events, owner notifications.               |
| `apps/mcp`       | `@halora/mcp`    | MCP server that exposes Halora wallet tools to any MCP-capable agent.                                    |
| `apps/webapp`    | `@halora/webapp` | Next.js owner dashboard: create agent wallets, edit policies, approve payments, view spending.           |

Contract IDs are data, not code: `apps/shared/src/contracts.testnet.json` is the source of truth.

## Commands

```bash
bun install            # install all workspace dependencies
bun run dev            # api + webapp
bun run build
bun run test
bun run lint
bun run typecheck
bun run format

# contracts (rustup is installed via Homebrew, so call cargo through rustup)
cd apps/contracts
rustup run stable cargo fmt --all -- --check
rustup run stable cargo clippy --all-targets -- -D warnings
rustup run stable cargo test
```

## Commit conventions

Conventional Commits, one atomic logical change per commit: `<type>(<scope>): <short, lowercase, no trailing punctuation>`. Scopes: `contracts`, `shared`, `sdk`, `api`, `mcp`, `webapp`, `docs`, `ci`.
