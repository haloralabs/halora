# Halora Product Brief (v1)

Status: v1, 2026-10-16. Expands the kickoff v0 with the strategy workstream's research. Every v0 decision is kept unless the [decision log](decision-log.md) records a change and the reason for it. External facts are tracked with status and source in the [integration verification matrix](integration-verification-matrix.md).

## One line

Halora gives AI agents a wallet with rules they cannot break: they pay for what they need, never more than their owner allows.

## Problem

AI agents increasingly need to pay for APIs, data and services per request. HTTP 402 machine payments (the x402 protocol, now governed by the x402 Foundation under the Linux Foundation) make this technically possible, and Stellar already settles x402 payments on testnet and mainnet. The missing piece is control. Today a team that wants an agent to pay has three poor options:

1. **Human-managed subscriptions and cards.** A person sets up an account per service. This does not scale to an agent that uses dozens of services, and it does not work for pay-per-request pricing.
2. **A plain wallet with funds.** The agent's key can spend everything. A prompt injection, a buggy tool loop or a leaked key drains the wallet in seconds.
3. **Custodial or enclave policy engines** (for example Coinbase CDP policies or Turnkey policies). These check rules before a signature is produced, inside the provider's infrastructure. They are useful, but the rules live with a vendor, they are mostly per-operation (not cumulative), and none of the major offerings documents Stellar support today.

Developers need limits that hold even if the agent, its runtime, or the developer's own backend is compromised, and that cost almost nothing per payment.

## Solution

A Soroban **custom account contract** per agent (`halora-account`). The owner funds it and sets a policy. The agent holds a separate signing key. Every payment the agent signs is evaluated by the contract's `__check_auth` before the token transfer can happen:

- Only transfers of the configured token (USDC first) are allowed for the agent key.
- Per-payment limit and daily limit (UTC day buckets).
- Optional recipient allowlist.
- Payments above an approval threshold require the owner's co-signature.
- Pause switch and expiry.

The owner key bypasses the policy (withdrawals, policy changes). The agent key can never change the policy. Because enforcement lives in the account contract, it holds even if the agent, the SDK, the API, or the MCP server is compromised.

Around the contract, Halora ships the pieces a developer needs to use it in minutes:

| Component        | What it does for the user                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@halora/sdk`    | Deploy and configure accounts, sign agent payments, x402-aware `fetch`, approval requests, local policy pre-flight. |
| `@halora/mcp`    | MCP server so any MCP-capable agent (Claude, IDE agents, custom frameworks) can check its budget and pay.           |
| `@halora/api`    | Approval queue for above-threshold payments, payment log indexed from chain data, owner notifications.              |
| `@halora/webapp` | Owner dashboard: create agent wallets, edit policies, approve or reject payments, see spending.                     |

### How x402 fits (research-backed, see matrix)

- On Stellar, x402 uses the `exact` scheme (x402 v2 only). The client builds a single `transfer(from, to, amount)` call on a SEP-41 token, signs only the **Soroban authorization entries**, and a facilitator rebuilds the transaction as source, pays the fee, and submits it. Source: [x402 Stellar exact spec](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_stellar.md).
- The spec states that auth-entry signing "supports both C-accounts and G-accounts", so a Halora contract account can be the payer at the specification level. End-to-end acceptance of a Halora payment by a production facilitator is **unverified** until we run it on testnet (T1 acceptance criterion).
- Two consequences shape our build:
  1. The off-the-shelf `@x402/stellar` client signs with a plain ed25519 signer. Halora's account expects a `HaloraSignature` value, so `@halora/sdk` ships its own x402 client that produces a spec-compliant payload with Halora credentials.
  2. The reference facilitators validate simulation events and reject any contract event that is not the token `transfer` event (read from source of `@x402/stellar` and the OpenZeppelin facilitator plugin). If that applies to events emitted inside `__check_auth`, the account must not emit its own events during authorization. This is flagged to the contracts workstream and is a T1 test.
- x402 auth entries must expire within the payment's `maxTimeoutSeconds` (about 60 seconds by default). A synchronous owner co-signature does not fit that window, so above-threshold x402 payments need an approval path that does not depend on the owner signing within one minute (see open questions).

## Users

1. **Primary: developers building agents.** They install `@halora/sdk` or the MCP server and get bounded payments in a few lines.
2. **Companies running agents.** They use the dashboard to set limits, approve large payments, and read a spending log.
3. **Service providers selling to agents (allies).** More agents that are allowed to pay means more paid requests. x402 resource servers on Stellar need no change to accept a Halora payer.

## Why Stellar

- **Cost and speed.** Sub-cent fees and about 5 second finality make per-request payments viable. In x402 the facilitator sponsors the fee, so the agent needs no XLM.
- **Native USDC** as a SEP-41 token through the Stellar Asset Contract.
- **Programmable accounts.** Soroban custom accounts let the account itself decide what a signature may authorize. This is the core of Halora and is not available as a protocol primitive on most chains.
- **x402 is live on Stellar** with a mainnet facilitator (OpenZeppelin Relayer plugin, used by the Stellar x402 facilitator), and SDF is a Premier member of the x402 Foundation launched on 2026-07-14 (reported by multiple outlets; SDF primary announcement not yet located).
- **Roadmap fit.** Protocol 27 (auth delegation, address-bound credentials) is live; Confidential Tokens are on testnet; ML-DSA host functions are an accepted CAP. These give Halora a credible path to private payments and post-quantum keys.

## Pilot scope (what the first SCF award funds)

In scope:

- `halora-account` contract with the policy above, full tests, testnet then mainnet deployment.
- `@halora/sdk`: deploy and configure accounts, agent payment signing, Halora x402 client, approval requests.
- `@halora/mcp`: MCP server with status, pay, paid fetch, approval and history tools.
- `@halora/api`: approval queue and payment log.
- `@halora/webapp`: owner dashboard with Freighter (through Stellar Wallets Kit) for owner signatures.
- Threat model and monitoring plan (an SCF Tranche 2 requirement).
- Mainnet launch with tested onboarding (SCF requires a functional product live on mainnet, not just a deployment).

Out of scope for the pilot (later phases, see [roadmap](roadmap.md)):

- Confidential (private) payments using Stellar Confidential Tokens.
- Post-quantum (ML-DSA) owner and agent keys.
- Multiple tokens per policy, per-recipient limits, anomaly detection.
- Hosted key custody. Halora never holds user keys in the pilot.
- Migrating to the OpenZeppelin smart account framework (evaluated, deferred, see decision log).

## Differentiation

| Approach                                | Where rules are enforced              | Cumulative limits                    | Stellar today                           |
| --------------------------------------- | ------------------------------------- | ------------------------------------ | --------------------------------------- |
| Coinbase CDP policies, Turnkey policies | Vendor signing infrastructure         | Mostly per-operation per public docs | Not documented                          |
| Safe modules (EVM)                      | On-chain module                       | Yes (allowance modules)              | No                                      |
| OpenZeppelin Stellar smart accounts     | On-chain, general framework           | Rolling window policy                | Yes (library, not a product)            |
| **Halora**                              | **On-chain, in the account contract** | **Per-tx and per-UTC-day**           | **Yes, with x402, SDK, MCP, dashboard** |

Full analysis: [competitive-landscape.md](competitive-landscape.md).

## Success metrics (pilot)

- Contract: 100 percent of policy rules covered by unit tests, including every error code, plus property tests for limit arithmetic.
- x402: an agent using `@halora/mcp` pays a real x402 endpoint on mainnet through a public facilitator, and a payment over the limit is rejected by the contract.
- Developer time to first bounded payment on testnet: under 10 minutes following the quickstart, measured with external developers.
- Mainnet at launch: at least 10 agent accounts created by people outside the team and at least 500 policy-checked payments in the first 30 days (targets, not commitments to SCF beyond the tranche criteria).

## Honest framing

Say "enforced on-chain by the account contract". Do not say "trustless" or "unhackable". The agent key must still be stored safely by the developer; Halora limits the damage if it leaks, it does not prevent the leak. The owner key is all-powerful by design and must be protected like any wallet key. The contract will be audited before mainnet through the SCF Audit Bank if eligible; until then it is unaudited and the docs say so.

## Open questions

Resolved by research (details in the decision log):

- x402 scheme on Stellar: `exact`, x402 v2, auth-entry signing, facilitator-sponsored fees. Contract payers are allowed by the spec. End-to-end Halora acceptance: to verify in T1.
- OpenZeppelin smart accounts: evaluated; custom `halora-account` kept for the pilot.
- Protocol 27: live on mainnet since the 2026-07-08 vote (Stellar software versions page). Halora does not depend on auth delegation in the pilot.
- SCF track and timing: Open Track; SCF #46 Build submissions close 2026-11-08.

Still open:

1. **Above-threshold x402 payments.** Options: (a) owner pre-approval stored on-chain that the next matching agent transfer consumes, (b) reject above-threshold x402 payments and only allow co-signed direct payments. Recommendation: (a), decided by the coordinator with the contracts workstream because it changes `interfaces.md`.
2. **Events inside `__check_auth`.** Confirm on testnet whether facilitators reject them; if yes, index payments from the token's `transfer` events instead.
3. **Address-bound credentials (CAP-71 V2).** SDK and Freighter must produce valid signatures for both the legacy and V2 preimages. Freighter's support for the V2 preimage is unverified.
4. **Facilitator for mainnet.** OpenZeppelin channels facilitator needs an API key; Coinbase's facilitator lists Stellar testnet only. Decide whether Halora also runs its own facilitator.
