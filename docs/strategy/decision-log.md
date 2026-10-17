# Decision Log

Chronological record of product and strategy decisions, with the reasoning behind each one. Status values: **Adopted** (in force), **Proposed** (recommended, needs the coordinator or the owning workstream to accept, usually because it changes `docs/architecture/interfaces.md`), **Rejected**, **Superseded**.

Sources for external facts are listed in [integration-verification-matrix.md](integration-verification-matrix.md).

---

## 2026-10-16: Name: Halora, not Aegent

**Status:** Adopted (founder decision at kickoff).

**Decision:** The project is named Halora.

**Reasoning:** The earlier working name "Aegent" collides with an existing crypto token branded ÆGENTS. Sharing a name with a token in the same market (agents and crypto payments) creates confusion for users and reviewers, makes search results unreliable, and is an avoidable trademark and reputational risk. Halora has no known conflict in this space. A formal trademark search has not been done and is listed as an open item for the founder.

## 2026-10-16: Network: Stellar

**Status:** Adopted.

**Decision:** Build on Stellar (Soroban) only for the pilot.

**Reasoning:**

- Soroban custom accounts let the account contract itself decide what a signature may authorize (`__check_auth`). That is exactly the enforcement point Halora needs, available natively rather than through an add-on such as ERC-4337.
- Sub-cent fees and about 5 second finality fit per-request payments.
- Native USDC through the Stellar Asset Contract (SEP-41).
- x402 is live on Stellar (testnet and mainnet facilitators exist) and SDF is a Premier member of the x402 Foundation (reported 2026-07-14).
- Few teams build on-chain agent spending guardrails as a product on Stellar today (see [competitive-landscape.md](competitive-landscape.md)), and SCF funding is available for exactly this stage.

**Rejected alternatives:** EVM (crowded: Safe modules, ERC-4337 session keys, Coinbase and Crossmint already cover it); multi-chain from day one (dilutes a small team before one chain is proven).

## 2026-10-16: Enforcement: one custom account contract per agent

**Status:** Adopted.

**Decision:** Each agent gets its own `halora-account` contract. The policy is checked in `__check_auth`. The agent key can only authorize transfers of the policy token; the owner key can do anything.

**Reasoning:** Enforcement in the account means it holds even if the SDK, API, MCP server or the agent runtime is compromised. One contract per agent keeps blast radius small and accounting simple. Off-chain policy engines (vendor signing infrastructure) were rejected as the core mechanism because the guarantee then depends on the vendor's infrastructure, which is the gap Halora exists to close.

## 2026-10-16: Keep custom `halora-account` instead of OpenZeppelin smart accounts (for the pilot)

**Status:** Adopted, revisit at the end of T2.

**What we checked:** OpenZeppelin Stellar Contracts (`packages/accounts`), latest stable v0.7.2 (2026-06-09), v0.8.0-rc.3 (2026-06-16); audit reports exist up to v0.7.0. The framework provides context rules (scope, signers, up to 5 policies, optional `valid_until` expiry as a ledger sequence), delegated and external signers (with verifier contracts), and built-in policies: simple threshold, weighted threshold, and a spending limit.

**What it covers and what it does not, for Halora's policy:**

| Halora rule                     | OZ built-in                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Token-only transfers for agent  | Yes, via a `CallContract` context rule scoped to the token                                 |
| Daily limit                     | Partly: spending limit uses a rolling window counted in ledgers, not UTC days              |
| Per-payment limit               | No built-in; needs a custom policy                                                         |
| Recipient allowlist             | No built-in; needs a custom policy                                                         |
| Owner co-sign above a threshold | No amount-conditional co-sign; would need a custom policy or two rules with a custom guard |
| Expiry                          | Yes (`valid_until` on the rule)                                                            |
| Pause                           | No direct switch; achievable by changing rules                                             |

**Reasoning for keeping custom in the pilot:**

1. Three of seven rules need custom policy contracts anyway, so we would still write and audit new Soroban code, plus deploy and wire policy contracts.
2. The OZ spending limit policy emits a `SpendingLimitEnforced` event during `enforce`, which runs inside authorization. The reference x402 facilitators reject simulations that contain contract events other than the token `transfer` event (see the x402 entry below). If confirmed, an OZ account with that policy would not pass x402 verification without changes upstream. This is inferred from source, not tested.
3. A single small contract with a fixed policy is easier to reason about, test exhaustively and audit than a general rule engine plus several policy contracts.
4. Rule selection in OZ is driven by the client (`context_rule_ids`), which is powerful but adds a class of configuration mistakes we do not need for one fixed policy shape.

**Why this is not final:** SCF reviewers favor reuse of ecosystem tools, and OZ accounts are becoming the Stellar standard (two SCF #44 awards build tooling for them). Plan: keep `halora-account` interfaces close to OZ concepts, and evaluate in phase 2 publishing Halora's rules as OZ-compatible policy contracts once OZ v0.8 is stable and the x402 event question is settled.

## 2026-10-16: x402 on Stellar: `exact` scheme v2, auth-entry signing, Halora's own client signer

**Status:** Adopted (SDK workstream).

**Facts (verified from the spec and source, 2026-10-16):**

- Stellar supports only the `exact` scheme and only x402 v2. Networks `stellar:pubnet` and `stellar:testnet`.
- Payload: base64 transaction XDR with one `invokeHostFunction` calling `transfer(from, to, amount)` on the SEP-41 asset, with signed auth entries. The facilitator rebuilds the transaction with itself as source, pays fees, re-simulates and submits.
- The spec says auth-entry signing "supports both C-accounts and G-accounts".
- Auth entries must use `sorobanCredentialsAddress` or `sorobanCredentialsAddressV2`; `sorobanCredentialsAddressWithDelegates` is forbidden; no sub-invocations; expiration no later than `currentLedger + ceil(maxTimeoutSeconds / ledgerSeconds)`.
- Facilitators must check that simulation shows only the expected balance change. The `@x402/stellar` facilitator and the OpenZeppelin facilitator plugin both reject any contract-type event that is not a `transfer` event from the asset contract.

**Decisions:**

1. `@halora/sdk` implements its own x402 `exact` client for Stellar that produces a spec-compliant payload but signs the auth entry with Halora credentials (`HaloraSignature::Agent`). The stock `@x402/stellar` client uses a plain ed25519 signer and is not compatible with the Halora signature format as is.
2. The SDK supports both credential arms (legacy and CAP-71 V2) when signing.
3. Halora never relies on auth delegation (`AddressWithDelegates`) for x402 payments, since the spec forbids it.

## 2026-10-16: No contract events inside `__check_auth` (pending test)

**Status:** Proposed to the contracts and API workstreams. Changes `interfaces.md` (events table).

**Decision proposed:** `halora-account` must not publish events from `__check_auth`. The payment log is built from the token's own `transfer` events where `from` is the account contract (CAP-67 unified events), plus the contract's `spent_today` view. Owner-only methods (`set_policy`, `pause`, and so on) may keep their events because they never run inside an x402 payment.

**Reasoning:** see the x402 entry. If a testnet run shows facilitators accept the account's own events, this proposal is withdrawn.

## 2026-10-16: Above-threshold x402 payments need an approval path that survives the 60 second window

**Status:** Proposed. Changes `interfaces.md` (new owner method and auth rule).

**Problem:** x402 auth entries expire within the payment's `maxTimeoutSeconds` (default about 60 seconds, about 12 ledgers). An owner co-signature collected through the dashboard will usually arrive later than that, so `AgentWithOwner` cannot work for x402 in practice. It still works for direct `pay()` calls, where the SDK can set a longer auth expiration.

**Proposal:** add an owner-only `approve_payment(to, amount, expires_at)` that stores a one-time allowance. In `__check_auth`, an agent transfer above the threshold is allowed if a matching, unexpired allowance exists, and the allowance is consumed. The approval request flow in the API stays the same, only the owner's action changes from "co-sign this entry" to "submit an approval transaction".

**Fallback if not adopted:** the SDK rejects above-threshold x402 payments with `ApprovalRequired` and does not attempt a co-sign.

## 2026-10-16: Facilitators

**Status:** Adopted.

- Testnet: Coinbase facilitator (lists `stellar:testnet`, x402 v2, `exact`) or the OpenZeppelin channels testnet facilitator.
- Mainnet: OpenZeppelin channels facilitator (`https://channels.openzeppelin.com/x402`, API key required). The Coinbase facilitator does not list `stellar:pubnet` as of 2026-10-16.
- Halora does not operate its own facilitator in the pilot. It may later, using the open source OpenZeppelin plugin, if third-party facilitators block Halora payers.

## 2026-10-16: Protocol dependencies

**Status:** Adopted.

- Protocol 27 (CAP-71: auth delegation and address-bound credentials) is live on mainnet (vote 2026-07-08). Halora does not need delegation in the pilot; the SDK must handle the V2 credential preimage.
- Protocol 28 is live on mainnet (2026-09-16). No feature Halora depends on.
- Protocol 29 is listed on Stellar's software versions page (testnet 2026-09-29, mainnet 2026-10-01). Contents not verified by this workstream.
- Confidential Tokens: testnet developer preview, not on mainnet, audit pending. Phase 2 only.
- ML-DSA host functions (CAP-87): Accepted, protocol version TBD. Phase 3 only.

## 2026-10-16: Correction to v0 brief: x402 Foundation membership

**Status:** Adopted, with caveat.

The v0 brief said Stellar is a member of the x402 Foundation. Research confirms that SDF joined as a Premier member when the Linux Foundation launched the x402 Foundation on 2026-07-14, but the evidence found is secondary press coverage. Marked as "reported" until the SDF primary announcement is linked.

## 2026-10-16: SCF track, size and timing

**Status:** Adopted.

- **Track: Open Track.** Halora is a new primitive with no existing traction, which rules out the Integration Track (it requires existing traction and an on-chain metric for the final tranche). The RFP Track requires an active RFP; the Q4 2026 RFPs are listed as "coming soon" as of 2026-10-16. Re-check when they are published.
- **Size: USD 72,000**, below the USD 150,000 cap. The handbook states that over-scoped budgets perform poorly and that requesting the maximum is not expected. The number is built bottom-up from hours (see [scf-application.md](../grants/scf-application.md)).
- **Round:** submit the interest form immediately. SCF #46 Build submissions close 2026-11-08. If the invitation arrives too late to submit a complete application, target the next round (SCF #47, dates not yet published).
- Audit costs are excluded from the budget (handled by the SCF Audit Bank for eligible projects), as are marketing costs, per the SCF budget guidelines.

## 2026-10-16: No contract events during authorization

**Status:** Adopted (coordinator).

The reference x402 facilitators (Coinbase and OpenZeppelin) reject simulations that contain contract events other than the token `transfer` event (read from source, not yet tested end to end). `halora-account` therefore emits no events from `__check_auth`. The payment log is built from the token's own `transfer` events where `from` is the account. Owner methods still emit events.

## 2026-10-16: On-chain pre-approval replaces co-signing for x402

**Status:** Adopted (coordinator).

x402 authorization entries expire within the payment's `maxTimeoutSeconds` (about 60 seconds), which is too short for a human owner to co-sign. The owner instead calls `approve_payment(to, amount, expires_at)`, a one-time allowance consumed by the next matching agent transfer. Per-payment and daily limits still apply. `AgentWithOwner` co-signing is kept for direct (non-x402) payments. See `docs/architecture/interfaces.md` section 1.
