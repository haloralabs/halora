# Halora API (`@halora/api`)

Elysia on Bun, PostgreSQL through Drizzle ORM. The API keeps the approval queue and the payment log for Halora agent accounts. It holds no keys, never signs, and never submits transactions: every spending rule is enforced on-chain by the account contract, and the API only records and relays state.

Canonical route list: [`docs/architecture/interfaces.md`](../architecture/interfaces.md) section 3. This document describes the behavior behind those routes.

## Running locally

```bash
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL 17 on 127.0.0.1:5432
cp apps/api/.env.example apps/api/.env           # adjust if needed
bun run --cwd apps/api db:migrate                # apply drizzle/ migrations
bun run dev:api                                  # http://localhost:3001
```

Configuration is read from the environment and validated at startup (see `apps/api/.env.example`). Important variables: `DATABASE_URL`, `HALORA_NETWORK`, `STELLAR_RPC_URL` (required on mainnet), `AUTH_DOMAIN`, `CORS_ORIGINS`, `TRUST_PROXY`.

## Authentication

### Owners: challenge and signature

1. `POST /v1/auth/challenge` with `{ "publicKey": "G..." }` returns `{ nonce, message, expiresAt }`. The message names `AUTH_DOMAIN`, the account, the nonce and an expiry (5 minutes by default), and states that it authorizes no payment.
2. The owner signs `message` with their Stellar key and calls `POST /v1/auth/verify` with `{ publicKey, nonce, signature }` (base64). Two signature encodings are accepted:
   - ed25519 over the UTF-8 message bytes (`Keypair.sign`), and
   - SEP-53 (`sha256("Stellar Signed Message:\n" + message)`), which wallets such as Freighter produce for `signMessage`.
3. The response is `{ token, publicKey, expiresAt }`. Send `Authorization: Bearer <token>`.

Each nonce is single-use: it is deleted before the signature is checked, so a failed attempt cannot be retried. Session tokens are opaque random values (`hls_...`), stored only as SHA-256 hashes, valid for one hour by default.

### Agents: API key

`POST /v1/accounts` returns an `apiKey` (`hak_<id>_<secret>`) exactly once. The API stores only its SHA-256 hash; lookups use the public id part, and the hash is compared in constant time. The agent sends `Authorization: Bearer <apiKey>`. A key only grants access to its own account.

## Routes

All errors use one shape: `{ "error": { "code", "message", "details?" } }`. Codes: `validation_error` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` and `approval_not_pending` (409), `approval_not_on_chain` (422), `rate_limited` (429), `chain_unavailable` (502), `internal_error` (500). Bodies are validated with zod and unknown fields are rejected. Amounts are integer strings in token base units.

| Method | Path                                       | Auth                         | Notes                                                                                                                                                                                                           |
| ------ | ------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                  | none                         | `{ "status": "ok" }`                                                                                                                                                                                            |
| POST   | `/v1/auth/challenge`                       | none                         | Body `{ publicKey }`                                                                                                                                                                                            |
| POST   | `/v1/auth/verify`                          | none                         | Body `{ publicKey, nonce, signature }`                                                                                                                                                                          |
| POST   | `/v1/accounts`                             | owner                        | Body `{ contractId, label, agentPublicKey?, network? }`. Reads `owner()`, `agent()` and `policy()` from the contract; refuses (403) unless `owner()` is the signed-in key. Returns `{ account, apiKey }` (201). |
| GET    | `/v1/accounts`                             | owner                        | `{ accounts: AgentAccount[] }`                                                                                                                                                                                  |
| GET    | `/v1/accounts/:contractId/payments?limit=` | owner or the account's agent | `{ payments: PaymentRecord[] }`, newest first, `limit` 1 to 200 (default 50)                                                                                                                                    |
| POST   | `/v1/approvals`                            | agent                        | Body `{ contractId, token, to, amount, reason, expiresInSeconds? }`. 201 with the new request; 200 with the existing one if an identical request is already pending. Default lifetime one hour (60 s to 24 h).  |
| GET    | `/v1/approvals?contractId=&status=&limit=` | owner or agent               | Owners see all their accounts; agents only their own.                                                                                                                                                           |
| GET    | `/v1/approvals/:id`                        | owner or agent               | The agent polls this. Approvals on other accounts return 404.                                                                                                                                                   |
| POST   | `/v1/approvals/:id/approve`                | owner                        | Body `{ approvalTxHash }`, see below.                                                                                                                                                                           |
| POST   | `/v1/approvals/:id/reject`                 | owner                        | Body `{ reason? }`; stored and returned as `rejectionReason`.                                                                                                                                                   |

## Approval sequence

Approval uses the contract's one-time pre-approval (`approve_payment(to, amount, expires_at)`), not owner co-signing, because x402 authorization entries expire in about a minute.

```
Agent (SDK/MCP)            Halora API                  Owner (webapp)            Account contract
     |  pay(to, amount)        |                            |                           |
     |  preflight: ApprovalRequired (amount > threshold)    |                           |
     |-- POST /v1/approvals -->|  status = pending          |                           |
     |<-- 201 { id } ----------|                            |                           |
     |                         |<-- GET /v1/approvals ------|                           |
     |                         |                            |-- approve_payment(to, amount, expires_at) -->|
     |                         |<-- POST /:id/approve { approvalTxHash }                |
     |                         |-- simulate approval(to) ------------------------------>|
     |                         |   requires amount >= requested and expires_at > now    |
     |                         |   status = approved                                    |
     |-- GET /v1/approvals/:id>|                            |                           |
     |<-- approved ------------|                            |                           |
     |-- token.transfer(account, to, amount), agent-signed -------------------------->  |
     |                         |   __check_auth consumes the approval (one-time)        |
     |                         |<-- indexer: token transfer event, from = account       |
     |                         |   status = submitted                                   |
```

Details:

- **The API never submits payments.** After `approved`, the agent retries the same payment itself (SDK `waitForApproval`). The contract checks the approval again and consumes it.
- **Approve is verified on-chain, fail closed.** The API calls the account's `approval(to)` view through a Stellar RPC simulation. No approval, a smaller amount, or an expired approval returns 422 `approval_not_on_chain` (the webapp can retry a few seconds later if its transaction was just submitted). If RPC cannot be reached the API returns 502 and the request stays `pending`. The submitted `approvalTxHash` is stored for display; the security-relevant check is the on-chain `approval(to)` state, not the hash.
- **Transitions are compare-and-set** (`pending -> approved | rejected | expired`, `approved -> submitted`), so concurrent approve and reject cannot both win.
- **Expiry.** A worker marks pending requests past `expiresAt` as `expired` every 15 seconds, and reads already report `expired` lazily in between. Expired, rejected and submitted requests are final.
- **`submitted`** is set by the payment indexer when it sees a transfer from the account to the same recipient with an amount not above the approved amount (the oldest matching approved request moves).

## Payment indexer

The contract emits no events inside `__check_auth` (interfaces.md section 1), so payments are read from the token's own `transfer` events. Every 5 seconds, for each registered account, the indexer calls Stellar RPC `getEvents` on the account's policy token with topic filters `("transfer", from = account, *, *)` (Stellar Asset Contract layout, the fourth topic is the asset) and `("transfer", from = account, *)` (plain SEP-41). The data is the `i128` amount, or a map with `amount` for muxed recipients. Each event becomes a `PaymentRecord` keyed by the RPC event id, so re-indexing is idempotent, and a cursor per account is stored in `indexer_cursors`. A new account starts about one day of ledgers back (within RPC retention). A failure on one account does not stop the others.

Limitations (v0): the token is read from `policy()` at registration; if the owner later changes the policy token, the indexer keeps following the original token until the account is re-registered. The chain does not say whether a transfer paid an x402 resource, so records are stored with `source: "direct"` and no `resource`.

## Security notes

- Rate limiting: fixed window per client IP, `RATE_LIMIT_PER_MINUTE` (default 120) for the API and one sixth of that (minimum 5) for `/v1/auth/*`. In memory, so a multi-instance deployment needs a shared store. `X-Forwarded-For` is used only when `TRUST_PROXY=true`.
- Logs are structured JSON lines with method, path, status and duration. Headers, query strings and bodies are never logged; fields whose names look like secrets, anything shaped like a Stellar secret seed or bearer token, and database query parameters are redacted.
- CORS allows only `CORS_ORIGINS`, methods GET, POST and OPTIONS, and no credentials.

## Tests

`bun test` in `apps/api` runs entirely in memory: repositories have in-memory implementations behind the same interfaces as the Drizzle ones, and Stellar RPC access goes through an injected `ChainReader` that tests replace with a fake. No database and no network are needed. CI additionally applies the migrations to a PostgreSQL service and checks that `src/db/schema.ts` and `drizzle/` are in sync.
