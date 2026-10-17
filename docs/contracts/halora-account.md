# `halora-account` contract

A Soroban custom account (implements `CustomAccountInterface`) that holds an AI agent's funds and enforces the owner's spending policy in `__check_auth`. One instance is deployed per agent. The public interface is defined in [`docs/architecture/interfaces.md`](../architecture/interfaces.md), section 1; this document explains the design, the exact authorization rules, the threat model and the known limitations.

Source: `apps/contracts/contracts/halora-account`. SDK: `soroban-sdk` 29.0.1.

## Design

### Keys and roles

| Role  | Key                | Power                                                                                                                                |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Owner | ed25519 public key | Authorizes anything on behalf of the account: withdrawals, `set_policy`, `set_agent`, `pause`, `unpause`. Not subject to the policy. |
| Agent | ed25519 public key | Authorizes only `policy.token.transfer(from = this account, to, amount)` within the policy.                                          |

The owner key and the agent key must differ (`InvalidPolicy` otherwise), both at construction and in `set_agent`.

### How a payment is authorized

1. The agent (via `@halora/sdk` or `@halora/mcp`) builds a `transfer(account, to, amount)` call on the policy token and signs the Soroban authorization payload with the agent key, producing `HaloraSignature::Agent(Signature { public_key, signature })`.
2. The token contract calls `from.require_auth()`. Because `from` is this contract, the host invokes `__check_auth(payload, signature, auth_contexts)`.
3. `__check_auth` verifies the signature, checks every auth context against the policy, adds the amounts to the current UTC day's counter, consumes any pre-approval it used, and returns `Ok`. It emits no events. Any error denies the whole authorization, and the transaction (including the counter update) is rolled back.

For amounts above `approval_threshold` the agent signature alone is not enough. There are two ways to satisfy the threshold; all other policy checks (pause, expiry, allowlist, per-transaction and daily limits) still apply to both:

- **Pre-approval (for x402).** x402 authorization entries expire in about 60 seconds, which is too short for an owner to co-sign. Instead the owner calls `approve_payment(to, amount, expires_at)` ahead of time. The next agent transfer to `to` with `transfer_amount <= amount` while `ledger.timestamp < expires_at` passes the threshold rule and **consumes** the approval (it is removed inside `__check_auth`, one-time use). A new `approve_payment` for the same recipient replaces the old one; `revoke_approval(to)` removes it; `approval(to)` returns it, or `None` when absent or expired.
- **Co-signature (for direct payments).** The owner signs the same payload and the agent submits `HaloraSignature::AgentWithOwner(agent_sig, owner_sig)`.

### Owner-only methods

`set_policy`, `set_agent`, `pause`, `unpause`, `approve_payment` and `revoke_approval` call `env.current_contract_address().require_auth()`. The host routes that to `__check_auth` with a context for the method itself. That context is not a token transfer, so only an `Owner` signature passes; an `Agent` or `AgentWithOwner` signature is rejected with `UnsupportedCall`.

### Storage

Account state lives in instance storage, so one TTL covers it:

| Key      | Value                                   |
| -------- | --------------------------------------- |
| `Owner`  | `BytesN<32>`                            |
| `Agent`  | `BytesN<32>`                            |
| `Policy` | `Policy`                                |
| `Spend`  | `SpendState { day: u64, amount: i128 }` |

Pre-approvals live in persistent storage under `Approval(to: Address)`, value `Approval { amount: i128, expires_at: u64 }`, one per recipient. Each is kept alive (TTL) until about one day past its `expires_at`, capped at the network maximum. An expired approval is treated as absent, and an archived one makes the transaction fail, which is fail closed.

`day` is `ledger.timestamp / 86400` (UTC day bucket). When the stored `day` is older than the current day, the counter reads as zero, so the daily limit resets at 00:00 UTC without a cleanup transaction. A single entry is overwritten instead of one entry per day, so storage does not grow.

The instance TTL is extended on construction, every owner method and every `__check_auth` call: when it falls below about 30 days it is extended to about 120 days (in ledgers at a 5 second close time), capped at the network's maximum TTL. If the instance is ever archived, every call fails until it is restored, which is fail closed. The counter is never stored in temporary storage, because a temporary entry that expired early would silently reset the counter and fail open.

### Events

Events are emitted only by owner methods, never by `__check_auth`: x402 facilitators reject simulations that contain contract events other than the token's own `transfer` event. Agent payments are therefore observed through the token's `transfer` events where `from` is the account.

| Topic                         | Data                   | Emitted by          |
| ----------------------------- | ---------------------- | ------------------- |
| `("policy_updated")`          | `Policy`               | `set_policy`        |
| `("agent_rotated")`           | `agent: BytesN<32>`    | `set_agent`         |
| `("paused")` / `("unpaused")` | `()`                   | `pause` / `unpause` |
| `("approved", to)`            | `(amount, expires_at)` | `approve_payment`   |
| `("approval_revoked", to)`    | `()`                   | `revoke_approval`   |

Consuming an approval in `__check_auth` emits nothing; indexers detect it as a token transfer to `to` above the threshold, and can confirm with the `approval(to)` view.

## Authorization rules

`__check_auth` evaluates in this order. The first failing rule determines the error.

| Step | Applies to                | Rule                                                                                                                                                                                                                   | Error                 |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1    | all                       | Owner, agent and policy are stored                                                                                                                                                                                     | `NotInitialized`      |
| 2    | all                       | Each `Signature.public_key` equals the expected key for its slot (owner slot = owner, agent slot = agent)                                                                                                              | `InvalidSignature`    |
| 3    | all                       | Each signature is a valid ed25519 signature over the payload (`env.crypto().ed25519_verify`)                                                                                                                           | host trap (denied)    |
| 4    | `Owner`                   | Nothing else: any context is allowed                                                                                                                                                                                   | none                  |
| 5    | `Agent`, `AgentWithOwner` | At least one context, and every context is `Contract` call to `policy.token`, function `transfer`, exactly 3 args, `from == this account`, `to` is an `Address`, `amount` is an `i128` and `> 0`                       | `UnsupportedCall`     |
| 6    | agent                     | `policy.paused == false`                                                                                                                                                                                               | `Paused`              |
| 7    | agent                     | `policy.expires_at == 0` or `ledger.timestamp < policy.expires_at`                                                                                                                                                     | `Expired`             |
| 8    | agent, per transfer       | If `allowlist_enabled`, `to` is in `allowlist`                                                                                                                                                                         | `RecipientNotAllowed` |
| 9    | agent, per transfer       | `amount <= per_tx_limit`                                                                                                                                                                                               | `PerTxLimitExceeded`  |
| 10   | agent, per transfer       | `spent_today + (earlier transfers in this auth) + amount <= daily_limit` (checked add, overflow denies)                                                                                                                | `DailyLimitExceeded`  |
| 11   | agent, per transfer       | `amount <= approval_threshold`, or the signature is `AgentWithOwner`, or a non-expired approval for `to` exists with `amount <= approval.amount` and was not already used by an earlier transfer in this authorization | `ApprovalRequired`    |
| 12   | agent                     | Record the new day total and remove the approvals used (state is written only after every check passes; no events)                                                                                                     | none                  |

Multiple transfer contexts in a single authorization are summed against the daily limit; per-transaction and approval-threshold checks apply to each transfer individually. One unsupported context rejects the whole authorization. An approval covers at most one transfer, even when one authorization contains several transfers to the same recipient.

### Policy validation (`__constructor`, `set_policy`)

A policy is rejected with `InvalidPolicy` when any of these hold:

- `per_tx_limit`, `daily_limit` or `approval_threshold` is negative.
- `per_tx_limit > daily_limit`.
- `token` is the account itself.
- `allowlist` has more than 50 entries (`MAX_ALLOWLIST_LEN`), bounding storage and `__check_auth` cost.
- `allowlist_enabled` is true and `allowlist` is empty (this would block every payment; use `pause` for that).
- `expires_at != 0` and `expires_at <= ledger.timestamp` (already expired; use `pause` instead).

`approval_threshold` may be at or above `per_tx_limit`, which simply means co-signature is never required. A `daily_limit` of 0 is valid and blocks all agent payments.

## Threat model

Assets: the token balance held by the account, and the integrity of the policy.

| Threat                                                                            | Mitigation                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent is prompt-injected or buggy and tries to overspend                          | Per-transaction and daily limits, allowlist and approval threshold are enforced on-chain by the account contract, not by the SDK.                                                |
| Agent key leaks                                                                   | The attacker is bound by the same policy. Owner can `pause`, then `set_agent` to rotate. Damage is capped at the remaining daily budget until the owner reacts.                  |
| Agent tries to change its own policy, rotate keys, or unpause                     | Admin methods produce non-transfer auth contexts, which agent signatures can never satisfy (`UnsupportedCall`).                                                                  |
| Agent signs a different token, `approve`, `burn`, or a call on any other contract | Only `policy.token.transfer` is accepted; `approve` is rejected, so no allowance can be created to bypass limits.                                                                |
| Agent splits a large payment across several contexts in one transaction           | Amounts are summed against the daily limit within the authorization and across the day.                                                                                          |
| Negative or zero amount used to decrement the daily counter                       | Non-positive amounts are `UnsupportedCall`.                                                                                                                                      |
| Replay of a signed authorization                                                  | Soroban address credentials carry a nonce and an expiration ledger checked by the host; the payload includes the network ID, preventing cross-network replay. Covered by a test. |
| Signature from a third key, or agent key presented in the owner slot              | Public key must match the stored key for the slot before verification (`InvalidSignature`).                                                                                      |
| Approval reused, or used for more than approved                                   | Approvals are single use, bound to one recipient and a maximum amount, removed on use, and time limited. Per-transaction and daily limits still apply on top.                    |
| Counter state lost or unreadable                                                  | Counter lives in instance storage; archival blocks all calls rather than resetting the counter.                                                                                  |
| Owner key compromise                                                              | Out of scope for the contract: the owner key is the root of trust. Owners should keep it offline or in a hardware wallet.                                                        |

## Known limitations

- **Signature errors are not always typed.** A key mismatch returns `InvalidSignature`, but a cryptographically invalid signature traps inside `ed25519_verify` (a host error, not contract error 2). Both deny the authorization; clients should treat any auth failure as a denial.
- **Muxed destinations are not supported for the agent.** If `to` is passed as a `MuxedAddress` value the context does not decode as an `Address` and is rejected with `UnsupportedCall`.
- **Single token per policy.** Changing `policy.token` does not reset `spent_today`; the counter keeps the old token's base units for the rest of the day. This is conservative (it can only block, never allow extra spend).
- **Approvals are not tied to a policy version.** Changing the policy or rotating the agent key does not clear pending approvals; the owner should `revoke_approval` when that matters. Pausing still blocks them.
- **Policy changes do not reset the daily counter.** Lowering `daily_limit` below what was already spent blocks the agent for the rest of the day.
- **Day boundaries follow ledger time** (`ledger.timestamp`), which validators set close to, but not exactly at, wall-clock UTC.
- **The agent's authorization tree may contain only token transfers.** If some other contract in the call chain also calls `require_auth` for this account, its invocation becomes an auth context and the agent signature is rejected. A contract that simply calls `token.transfer(account, ...)` (so only the transfer needs the account's auth) works. Whether current x402 facilitators on Stellar support a contract-address payer in this way is unverified.
- **Spend is counted at authorization time.** If the transfer later fails, the whole transaction reverts, including the counter and the approval removal, so no budget or approval is consumed. Simulation results are not committed and also consume nothing.
- **No upgrade entry point.** The deployed code is immutable. A new version means deploying a new account and moving funds with the owner key.
- **ed25519 only.** No secp256r1 (passkey) or post-quantum keys in the pilot.
- **Release builds need the Stellar CLI.** `soroban-sdk` 29 refuses a plain `cargo build` for wasm targets unless the spec-shaking build flag is set, and only the Stellar CLI (v25.2.0+) shakes the spec correctly. `scripts/build-contracts.sh --compile-check` builds with plain cargo to prove the code compiles; that artifact must not be deployed.

## Building and testing

```bash
cd apps/contracts
rustup run stable cargo fmt --all -- --check
rustup run stable cargo clippy --all-targets -- -D warnings
rustup run stable cargo test

# deployable wasm (requires stellar-cli v25.2.0+ and the wasm32v1-none target)
scripts/build-contracts.sh
# compile check only, no Stellar CLI needed, NOT deployable
scripts/build-contracts.sh --compile-check
```

With the Homebrew `rustup`, `rustup run stable cargo` may fail with "could not execute process `rustc -vV`". Put the toolchain proxies on `PATH` first: `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"`.

Tests (`src/test.rs`) use a real Stellar Asset Contract and real ed25519 keys. Policy logic is exercised through `env.try_invoke_contract_check_auth`; end-to-end paths (agent payment, pre-approved payment, co-signed payment, owner withdrawal, owner admin calls, agent attempting admin calls, replay) build and sign genuine `SorobanAuthorizationEntry` values with `env.set_auths`, so the host computes the payload and calls `__check_auth` exactly as on-chain. CI runs the same checks plus the Stellar CLI build in `.github/workflows/contracts-ci.yml`.
