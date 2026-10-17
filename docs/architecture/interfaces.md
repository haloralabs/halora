# Interfaces (v0)

Canonical cross-workspace contract. Every workspace codes against this file. If you must change something here, update this file in the same change and note it in your report.

## 1. Contract: `halora-account`

Soroban custom account (implements `CustomAccountInterface`). One instance per agent.

### Constructor

```
__constructor(owner: BytesN<32>, agent: BytesN<32>, policy: Policy)
```

`owner` and `agent` are ed25519 public keys.

### Types

```rust
pub struct Policy {
    pub token: Address,            // token contract (USDC SAC first)
    pub per_tx_limit: i128,        // max amount per single transfer, in token base units
    pub daily_limit: i128,         // max total per UTC day (ledger timestamp / 86400)
    pub approval_threshold: i128,  // transfers with amount > threshold need owner co-signature
    pub allowlist_enabled: bool,   // when true, recipient must be in allowlist
    pub allowlist: Vec<Address>,
    pub expires_at: u64,           // unix seconds, 0 = never
    pub paused: bool,
}

pub enum HaloraSignature {
    Agent(Signature),                          // agent-only
    Owner(Signature),                          // owner-only, bypasses policy
    AgentWithOwner(Signature, Signature),      // agent + owner co-sign (for amounts above threshold)
}

pub struct Signature { pub public_key: BytesN<32>, pub signature: BytesN<64> }
```

### Authorization rules (enforced in `__check_auth`)

- `Owner` signature: any context is allowed.
- `Agent` or `AgentWithOwner` signature: every auth context must be a call to `policy.token` function `transfer(from = this account, to, amount)`. Any other context is rejected with `UnsupportedCall`.
- For each agent transfer, in order: not paused, not expired, recipient allowed (if enabled), `amount <= per_tx_limit`, `spent_today + amount <= daily_limit`, and if `amount > approval_threshold` either an owner co-signature (`AgentWithOwner`) or a valid pre-approval for that recipient is required.
- **Pre-approval (v1, decided 2026-10-16):** x402 auth entries expire in about 60 seconds, so owner co-signing does not fit x402. The owner calls `approve_payment(to, amount, expires_at)`; the next agent transfer to `to` with `transfer_amount <= amount` and before `expires_at` satisfies the threshold rule and **consumes** the approval (one-time use, removed in `__check_auth`). Per-payment and daily limits still apply. `AgentWithOwner` stays for direct (non-x402) payments.
- **No events inside `__check_auth` (v1, decided 2026-10-16):** x402 facilitators reject simulations containing contract events other than the token `transfer` event. The payment log is built from the token's `transfer` events where `from` is the account.
- Check order: every context must first be a supported transfer (amount > 0, non-muxed recipient), then paused, then expired, then the per-transfer checks.
- On success, `spent_today` is increased inside `__check_auth`, stored in instance storage as a single `SpendState { day, amount }` (not temporary storage, so an expired entry can never silently reset the counter). Changing the policy does not reset it.
- Fail closed: anything unexpected is denied. A forged signature aborts in the host rather than returning `InvalidSignature`; the payment is still denied.
- No upgrade function: deployed code is immutable.

### Owner-only methods (require `owner` auth)

`__constructor`, `set_policy`, `set_agent`, `pause`, `unpause`, `approve_payment` and `revoke_approval` return `Result<(), Error>`. Views panic with `NotInitialized` if state is missing.

```
set_policy(policy: Policy)
set_agent(agent: BytesN<32>)
pause()
unpause()
approve_payment(to: Address, amount: i128, expires_at: u64)   // amount > 0, expires_at in the future; replaces any existing approval for `to`
revoke_approval(to: Address)
```

### Views

```
owner() -> BytesN<32>
agent() -> BytesN<32>
policy() -> Policy
spent_today() -> i128
approval(to: Address) -> Option<Approval>   // Approval { amount: i128, expires_at: u64 }
```

### Errors (`#[contracterror]`, u32)

| Code | Name                |
| ---- | ------------------- |
| 1    | NotInitialized      |
| 2    | InvalidSignature    |
| 3    | UnsupportedCall     |
| 4    | Paused              |
| 5    | Expired             |
| 6    | RecipientNotAllowed |
| 7    | PerTxLimitExceeded  |
| 8    | DailyLimitExceeded  |
| 9    | ApprovalRequired    |
| 10   | InvalidPolicy       |

`InvalidPolicy` covers: negative limits, `per_tx_limit > daily_limit`, owner key equal to agent key, more than 50 allowlist entries, allowlist enabled but empty, `expires_at` already in the past, token equal to the account itself.

### Events

| Topic                         | Data                   |
| ----------------------------- | ---------------------- |
| `("policy_updated")`          | `Policy`               |
| `("agent_rotated")`           | `agent: BytesN<32>`    |
| `("paused")` / `("unpaused")` | `()`                   |
| `("approved", to)`            | `(amount, expires_at)` |
| `("approval_revoked", to)`    | `()`                   |

Events are emitted only from owner methods, never from `__check_auth`. Payments are observed through the token's own `transfer` event.

## 2. Shared types (`@halora/shared`)

Amounts are strings of integer base units in JSON (never JS numbers). Addresses are strkeys (`G...` or `C...`).

```ts
type Policy = {
  token: string;
  perTxLimit: string;
  dailyLimit: string;
  approvalThreshold: string;
  allowlistEnabled: boolean;
  allowlist: string[];
  expiresAt: number;
  paused: boolean;
};

type AgentAccount = {
  contractId: string;
  ownerPublicKey: string;
  agentPublicKey: string;
  label: string;
  network: 'testnet' | 'mainnet';
  createdAt: string;
};

type PaymentRecord = {
  id: string;
  contractId: string;
  token: string;
  to: string;
  amount: string;
  txHash: string;
  ledger: number;
  createdAt: string;
  source: 'x402' | 'direct';
  resource?: string; // x402 resource URL when known
};

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'submitted';

type ApprovalRequest = {
  id: string;
  contractId: string;
  token: string;
  to: string;
  amount: string;
  reason: string; // agent-provided justification shown to the owner
  approvalTxHash?: string; // hash of the owner's approve_payment transaction once approved
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
};

type HaloraErrorCode =
  | 'NotInitialized'
  | 'InvalidSignature'
  | 'UnsupportedCall'
  | 'Paused'
  | 'Expired'
  | 'RecipientNotAllowed'
  | 'PerTxLimitExceeded'
  | 'DailyLimitExceeded'
  | 'ApprovalRequired'
  | 'InvalidPolicy';
```

`@halora/shared` exports zod schemas for each type (`PolicySchema`, etc.), the error-code map (number to name, with human-readable messages), and `contracts.testnet.json` (`{ "haloraAccountWasmHash": "", "usdc": "" }`).

## 3. API (`@halora/api`, base path `/v1`)

| Method | Path                                | Auth           | Purpose                                                                                                                                                                   |
| ------ | ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                           | none           | Liveness                                                                                                                                                                  |
| POST   | `/v1/accounts`                      | owner          | Register an agent account (label, contractId)                                                                                                                             |
| GET    | `/v1/accounts`                      | owner          | List owner's accounts                                                                                                                                                     |
| GET    | `/v1/accounts/:contractId/payments` | owner          | Payment log (indexed from the token `transfer` events with `from` = account)                                                                                              |
| POST   | `/v1/approvals`                     | agent          | Create approval request                                                                                                                                                   |
| GET    | `/v1/approvals?contractId=&status=` | owner or agent | List approvals                                                                                                                                                            |
| GET    | `/v1/approvals/:id`                 | owner or agent | Read one (agent polls this)                                                                                                                                               |
| POST   | `/v1/approvals/:id/approve`         | owner          | Body `{ approvalTxHash }`: the webapp has the owner sign and submit `approve_payment` on-chain; the API verifies the on-chain `approval(to)` matches, then marks approved |
| POST   | `/v1/approvals/:id/reject`          | owner          | Body `{ reason? }`                                                                                                                                                        |

API notes (v1): the payments route also accepts the account's own agent key (used by the MCP `halora_recent_payments` tool). Reject stores the reason and responses include `rejectionReason`. `POST /v1/approvals` accepts optional `expiresInSeconds`, allows an empty `reason`, and returns the existing request when an identical one is already pending. Registration reads `owner()`, `agent()` and `policy()` from the contract and refuses a caller that is not the owner. Indexed payments are recorded with `source: 'direct'` because the chain does not reveal x402 origin.

Approval flow: agent `pay` hits `ApprovalRequired` in pre-flight -> SDK `POST /v1/approvals` -> owner sees it in the webapp and signs `approve_payment` -> webapp posts `approvalTxHash` -> agent polling `GET /v1/approvals/:id` sees `approved` and retries the same payment, which consumes the on-chain approval.

Owner auth: challenge-response with the owner's Stellar key (`POST /v1/auth/challenge`, `POST /v1/auth/verify` returning a session token). Agent auth: an API key per account, created at registration, sent as `Authorization: Bearer <key>`, stored hashed.

## 4. SDK (`@halora/sdk`) main surface

```ts
class HaloraClient {
  constructor(opts: { network: 'testnet' | 'mainnet'; rpcUrl?: string; apiUrl?: string });
  deployAccount(opts: { owner: Keypair; agentPublicKey: string; policy: Policy }): Promise<string>; // contractId
  getPolicy(contractId: string): Promise<Policy>;
  getSpentToday(contractId: string): Promise<bigint>;
  setPolicy(opts: { contractId: string; owner: Keypair; policy: Policy }): Promise<void>;
}

class HaloraAgent {
  constructor(opts: {
    contractId: string;
    agentSecret: string;
    network: 'testnet' | 'mainnet';
    apiUrl?: string;
    apiKey?: string;
  });
  pay(opts: {
    to: string;
    amount: bigint;
    reason?: string;
  }): Promise<PaymentResult | ApprovalPending>;
  fetch(input: string, init?: RequestInit): Promise<Response>; // x402-aware fetch: on HTTP 402, pays within policy and retries
  waitForApproval(id: string, opts?: { timeoutMs?: number }): Promise<PaymentResult>;
}
```

Result types (defined in `@halora/shared`):

```ts
type PaymentResult = {
  status: 'paid';
  contractId: string;
  token: string;
  to: string;
  amount: string;
  txHash: string;
  ledger: number;
};
type ApprovalPending = {
  status: 'approval_pending';
  approvalId: string;
  contractId: string;
  to: string;
  amount: string;
  expiresAt: string;
};
// POST /v1/approvals body (CreateApprovalBody): { contractId, token, to, amount, reason }
```

`HaloraClient` also exposes `approvePayment`, `revokeApproval`, `getApproval`, `setAgent`, `pause`, `unpause`, `getBalance`, `getOwner`, `getAgent`. Local pre-flight treats a policy as expired when `now >= expiresAt`.

Pre-flight: the SDK checks the policy locally before signing and returns a typed `HaloraPolicyError` early, but the contract remains the source of truth.

## 5. MCP server (`@halora/mcp`, stdio)

| Tool                     | Input                     | Output                                  |
| ------------------------ | ------------------------- | --------------------------------------- |
| `halora_status`          | none                      | balance, policy, spent today, remaining |
| `halora_pay`             | `to`, `amount`, `reason`  | payment result or approval id           |
| `halora_fetch_paid`      | `url`, `method?`, `body?` | response body (x402 auto-pay in policy) |
| `halora_approval_status` | `id`                      | approval status                         |
| `halora_recent_payments` | `limit?`                  | list of payments                        |

Configured with env vars: `HALORA_CONTRACT_ID`, `HALORA_AGENT_SECRET`, `HALORA_NETWORK`, `HALORA_API_URL`, `HALORA_API_KEY`.
