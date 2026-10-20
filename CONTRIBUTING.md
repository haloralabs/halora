# Contributing to Halora

Thanks for helping build Halora: Stellar wallets with rules for AI agents, enforced on-chain by a Soroban account contract. This guide covers how we work, how to set up the repo, what a good pull request looks like, and how contributions through [Drips Wave](https://www.drips.network/wave) work.

> **Contributing for Drips Wave points?** Read [Drips Wave](#drips-wave) before you start. It explains how issues are assigned, what we review, and what Halora does and does not control.

Questions and chat: the [Halora community on Telegram](https://t.me/+gSSO903wiRlkNjk5).

## Table of contents

1. [Ground rules](#ground-rules)
2. [Drips Wave](#drips-wave)
3. [Set up your environment](#set-up-your-environment)
4. [Working on an issue](#working-on-an-issue)
5. [Pull requests](#pull-requests)
6. [Commit conventions](#commit-conventions)
7. [Style and quality rules](#style-and-quality-rules)
8. [Security-sensitive changes](#security-sensitive-changes)
9. [Use of AI tools](#use-of-ai-tools)

## Ground rules

- Be kind and assume good intent. Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- **One issue at a time.** Do not ask to be assigned to a second issue until your first pull request is merged or closed.
- **Get assigned before you write code.** Comment on the issue first. Unassigned pull requests are closed, however good they are.
- **Security issues are never reported in public.** Follow [SECURITY.md](SECURITY.md).
- The product direction lives in [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md) and the cross-package contracts in [`docs/architecture/interfaces.md`](docs/architecture/interfaces.md). If your change disagrees with them, update the doc in the same pull request or ask first.

## Drips Wave

Halora takes part in [Drips Wave](https://www.drips.network/wave) programs (Stellar Wave). Issues in a Wave carry the program label (for example `Stellar Wave`) and a complexity that sets their points: **Trivial 100, Medium 150, High 200**. Our labels `complexity: trivial`, `complexity: medium` and `complexity: high` mirror that.

**How to take a Wave issue**

1. Apply on the issue through the Drips Wave app, and leave a short comment on GitHub: how you plan to solve it and your expected time to a first draft pull request. Comments like "can I work on this?" without a plan are not considered.
2. A maintainer assigns one contributor. Assignment happens in the Drips app or on GitHub; other applications on the same issue then become inactive.
3. Once assigned, you get the link to the private contributors group on Telegram in the issue. Use it to unblock yourself fast during the Wave.
4. Open a **draft pull request early** (within 48 hours of assignment) and link the issue (`Closes #123`). Silence for more than 72 hours during a Wave may lead to reassignment.
5. When the pull request is merged, a maintainer marks the issue **Resolved** in Drips. Points only count for issues resolved before the Wave ends.

**Our commitment**

- During a Wave we check applications and reviews daily and aim to give a first review within 24 hours of a pull request becoming ready.
- If a good pull request is blocked by something outside your control (for example a dependency or CI issue that is ours), we will still mark the issue resolved.
- We review every pull request on its technical merits, the same way with or without Drips. Points never lower the bar.

**What Halora does not control**

Drips is the system of record for points and rewards. Halora reviews and merges contributions; it does not set reward amounts, pay rewards or decide KYC. If points do not appear after we mark an issue resolved, contact Drips Wave support; we will help where we can.

**Not accepted for points:** typo-only changes, cosmetic churn, pull requests that were not assigned, and code you do not understand (see [Use of AI tools](#use-of-ai-tools)). Repeated low-effort submissions are reported to the Wave organizers under the [Drips Wave terms](https://docs.drips.network/wave/terms-and-rules/).

## Set up your environment

**Prerequisites**

- [Bun](https://bun.sh) 1.3 or newer
- Node.js 22 or newer (used by some tooling)
- For contract work: Rust (stable, via [rustup](https://rustup.rs)) with the `wasm32v1-none` target, and the [Stellar CLI](https://developers.stellar.org/docs/tools/cli) 28 or newer
- Docker, only if you work on the API (PostgreSQL)

**Fork and clone**

```bash
# 1. Fork https://github.com/haloralabs/halora on GitHub, then:
git clone https://github.com/<your-username>/halora.git
cd halora
git remote add upstream https://github.com/haloralabs/halora.git
bun install
```

**Run things**

```bash
bun run dev:webapp        # landing and dashboard in demo mode at http://localhost:3000
docker compose -f docker-compose.dev.yml up -d
bun run dev:api           # API at http://localhost:3001

cd apps/contracts
cargo test                # contract tests
```

**Keep your fork current**

```bash
git fetch upstream
git switch main && git merge --ff-only upstream/main
git switch your-branch && git rebase main
```

## Working on an issue

1. Read the whole issue, including the acceptance criteria and the files it points to. If anything is unclear, ask in the issue before you start.
2. Create a branch from an up-to-date `main`: `feat/short-description`, `fix/...`, `docs/...`, `test/...`, `chore/...`.
3. Keep the change focused on the issue. Unrelated refactors belong in their own issue.
4. Add or update tests. Every bug fix comes with a test that fails without the fix.
5. Run the checks below before you ask for review.

**Checks (all must pass, the same as CI)**

```bash
bun run format
bun run typecheck
bun run lint
bun run test
bun run build

# only if you changed apps/contracts:
cd apps/contracts
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test
stellar contract build
```

## Pull requests

- Target `main`. It is protected: `monorepo-ci` must pass and history stays linear (we squash merge).
- Fill in the pull request template: what changed, why, how you tested it, and screenshots or a short recording for UI changes (desktop and phone width).
- Link the issue with `Closes #123`.
- Keep pull requests small enough to review in one sitting. Split big work into steps.
- Respond to review comments by pushing new commits; do not force-push over a review in progress.

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org): `<type>(<scope>): <short, lowercase summary>`.

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`, `style`.
- Scopes: `contracts`, `shared`, `sdk`, `api`, `mcp`, `webapp`, `docs`, `ci`.
- One logical change per commit. Example: `fix(sdk): reject x402 requirements without sponsored fees`.

Never commit secrets: no Stellar secret seeds (even testnet), API keys, `.env` files or wallet exports.

## Style and quality rules

These apply to code, comments, commit messages, pull requests and docs:

- **No em dashes, anywhere.** Use a comma, a period, a colon or parentheses.
- **No emojis** in code, commits, pull requests or docs. Icons in the UI come from `lucide-react` only.
- TypeScript is strict. No `any` without a comment explaining why.
- Amounts are `bigint` in base units in code and integer strings in JSON. Never use floating point for money.
- UI work follows [`docs/design-system/`](docs/design-system/): use the existing tokens and components, keep 44px touch targets, visible focus, and respect `prefers-reduced-motion`.
- Honest claims: write "enforced on-chain by the account contract", never "trustless" or "unhackable".

## Security-sensitive changes

`apps/contracts` and the signing code in `apps/sdk` move money. Changes there need:

- tests for the new behaviour and for the failure paths (the contract must fail closed);
- an explanation in the pull request of what an attacker could do before and after the change;
- a review by a core maintainer, even for small diffs.

Changes to `docs/architecture/interfaces.md` (contract methods, errors, shared types, API routes, MCP tools) must be agreed in the issue first.

## Use of AI tools

You may use AI assistants. You are responsible for every line you submit:

- you understand it and can explain it in review;
- you ran it and tested it;
- it follows this guide (the style rules above apply to generated text too).

Low-quality, untested or unexplained generated code is closed, and in a Drips Wave it is treated as a low-effort submission. Say in the pull request description if a significant part was generated.
