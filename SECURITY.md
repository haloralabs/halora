# Security policy

Halora is software that moves money: an account contract that enforces spending policies for AI agents, and an SDK that signs payments. We take reports seriously and ask that you give us a chance to fix issues before they are public.

## Report a vulnerability

**Do not open a public issue, pull request or Telegram message about a vulnerability.**

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (private vulnerability reporting). Include:

- what is affected (contract, SDK, MCP server, API, webapp) and the commit or version;
- how to reproduce it, ideally on Stellar testnet;
- what an attacker could achieve (for example spend above a policy limit, bypass the allowlist, use an approval twice, read a secret);
- any suggested fix.

We aim to acknowledge a report within 3 working days and to share a first assessment within 7 days. We will credit you in the advisory unless you ask us not to.

## Scope

In scope:

- `apps/contracts` (`halora-account`): any way for an agent signature to authorize something the policy forbids, to reset or bypass limits, or to reuse an approval.
- `apps/sdk` and `apps/mcp`: signing the wrong payload, leaking the agent secret, or bypassing the local pre-flight in a way that matters.
- `apps/api`: authentication, approval handling and data exposure.
- `apps/webapp`: owner-signing flows and anything that could trick an owner into signing.

Out of scope: denial of service by volume, issues in third-party services (Stellar RPC providers, x402 facilitators, wallets) unless Halora uses them unsafely, and findings that need a compromised owner key.

## Supported versions

Halora is a pilot on Stellar **testnet**. The `main` branch is the only supported version. There is no bug bounty yet; a mainnet launch will come with an audit and an updated policy.

## Handling secrets

Never paste secret seeds, API keys or private keys into issues, pull requests, logs or chat, even for testnet. If you believe a secret was exposed, report it privately as above.
