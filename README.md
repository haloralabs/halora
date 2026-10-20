<div align="center">

# Halora

**A halo for every agent. Policy-bound wallets for AI agents, on Stellar.**

[![monorepo-ci](https://github.com/haloralabs/halora/actions/workflows/monorepo-ci.yml/badge.svg)](https://github.com/haloralabs/halora/actions/workflows/monorepo-ci.yml)
[![contracts-ci](https://github.com/haloralabs/halora/actions/workflows/contracts-ci.yml/badge.svg)](https://github.com/haloralabs/halora/actions/workflows/contracts-ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-2df5b4.svg)](LICENSE)
[![Telegram](https://img.shields.io/badge/community-Telegram-19d3e0.svg)](https://t.me/+gSSO903wiRlkNjk5)

</div>

AI agents increasingly pay for APIs, data and services on their own, per request. Halora gives each agent a Stellar smart account with rules it cannot break: a per-payment limit, a daily limit, an optional recipient allowlist, owner approval above a threshold, a pause switch and an expiry. Every payment the agent signs is checked by the account contract before the transfer happens, so a manipulated or buggy agent can never spend more than its owner allowed. Rules are enforced on-chain by the account contract, not by the agent, the SDK or our servers.

Halora works with x402 pay-per-request payments on Stellar: the agent signs only the authorization entries, a facilitator pays the fee, and the agent needs no XLM.

**Live demo: [halora-ten.vercel.app](https://halora-ten.vercel.app)** (landing and owner dashboard in demo mode, no real funds)

[Product brief](docs/strategy/product-brief.md) · [Roadmap](docs/strategy/roadmap.md) · [Interfaces](docs/architecture/interfaces.md) · [Contract](docs/contracts/halora-account.md) · [SDK](docs/sdk/README.md) · [API](docs/api/README.md)

## How it works

1. **Create.** The owner deploys a `halora-account` for the agent, funds it with USDC and sets a policy.
2. **Connect.** The developer gives the agent its key through `@halora/sdk` or the `@halora/mcp` server.
3. **Pay within limits.** The agent pays on its own. Payments above the approval threshold wait for the owner's on-chain pre-approval from the dashboard.

## Repository

| Path             | Package          | Role                                                                       |
| ---------------- | ---------------- | -------------------------------------------------------------------------- |
| `apps/contracts` | Rust / Soroban   | `halora-account` custom account that enforces the policy in `__check_auth` |
| `apps/shared`    | `@halora/shared` | Types, zod schemas, error map, policy helpers, contract IDs                |
| `apps/sdk`       | `@halora/sdk`    | Account management, agent payments, x402 client, approvals                 |
| `apps/api`       | `@halora/api`    | Elysia API: approval queue, payment indexer, owner and agent auth          |
| `apps/mcp`       | `@halora/mcp`    | MCP server exposing Halora wallet tools to any MCP-capable agent           |
| `apps/webapp`    | `@halora/webapp` | Next.js owner dashboard and landing page                                   |

## Getting started

Prerequisites: [Bun](https://bun.sh) 1.3+, Rust via rustup, Docker (for PostgreSQL), and the Stellar CLI for deployable contract builds.

```bash
bun install
bun run dev:webapp          # dashboard in mock mode at localhost:3000

docker compose -f docker-compose.dev.yml up -d
bun run dev:api             # API at localhost:3001

cd apps/contracts && cargo test
```

Checks before any change is done: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, `bun run format`, and for contracts `cargo fmt --all -- --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`.

## Status

Pilot under construction, targeting the Stellar Community Fund. `halora-account` is live on testnet and verified end to end through the SDK (allowed, held and approved payments; over-limit and unknown-recipient payments refused by the contract): see [docs/deployment/testnet.md](docs/deployment/testnet.md). Next: an x402 payment through a live facilitator. Plan: [docs/planning/mvp-roadmap.md](docs/planning/mvp-roadmap.md).

## Contributing

Halora is open source and welcomes contributors, including through [Drips Wave](https://www.drips.network/wave). Start with [CONTRIBUTING.md](CONTRIBUTING.md), pick an issue labelled [`help wanted`](https://github.com/haloralabs/halora/issues?q=is%3Aopen+label%3A%22help+wanted%22) or [`good first issue`](https://github.com/haloralabs/halora/issues?q=is%3Aopen+label%3A%22good+first+issue%22), and say hello in the [community Telegram](https://t.me/+gSSO903wiRlkNjk5).

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md): report vulnerabilities privately, never in public issues.

## License

Apache-2.0. See [LICENSE](LICENSE).
