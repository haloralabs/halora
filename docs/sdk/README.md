# Halora SDK

`@halora/sdk` is the TypeScript SDK for Halora: policy-bound Stellar wallets for AI agents. An owner deploys a `halora-account` Soroban custom account per agent, funds it with USDC and sets a spending policy. The agent holds its own key and pays with it. Every payment is enforced on-chain by the account contract in `__check_auth`, so the SDK is a convenience layer, not the security boundary.

Status: pilot, testnet first. Amounts are always integer base units (`bigint` in code, decimal strings in JSON). USDC on Stellar has 7 decimals: `1 USDC = 10_000_000n`.

## Install

```bash
bun add @halora/sdk @stellar/stellar-sdk
```

Inside this monorepo the workspaces resolve `@halora/sdk` and `@halora/shared` from source.

## Quickstart

### 1. Owner: deploy and configure an agent account

```ts
import { Keypair } from '@stellar/stellar-sdk';
import { HaloraClient } from '@halora/sdk';
import { parseUsdc, CONTRACTS } from '@halora/shared';

const owner = Keypair.fromSecret(process.env.OWNER_SECRET!); // testnet key, never committed
const agentKey = Keypair.random(); // hand agentKey.secret() to the agent runtime

const client = new HaloraClient({ network: 'testnet' });

const contractId = await client.deployAccount({
  owner,
  agentPublicKey: agentKey.publicKey(),
  policy: {
    token: CONTRACTS.testnet.usdc, // USDC SAC contract ID
    perTxLimit: parseUsdc('1').toString(), // 1 USDC per payment
    dailyLimit: parseUsdc('10').toString(), // 10 USDC per UTC day
    approvalThreshold: parseUsdc('0.5').toString(), // above this needs owner approval
    allowlistEnabled: false,
    allowlist: [],
    expiresAt: 0, // never
    paused: false,
  },
});
```

Then fund the contract address with USDC (a normal token transfer to `contractId`).

Other owner operations: `setPolicy`, `setAgent`, `pause`, `unpause`, `approvePayment`, `revokeApproval`. Views: `getPolicy`, `getSpentToday`, `getApproval`, `getBalance`, `getOwner`, `getAgent`.

### 2. Agent: pay directly

```ts
import { HaloraAgent, HaloraPolicyError } from '@halora/sdk';

const agent = new HaloraAgent({
  contractId: process.env.HALORA_CONTRACT_ID!,
  agentSecret: process.env.HALORA_AGENT_SECRET!,
  network: 'testnet',
  apiUrl: process.env.HALORA_API_URL, // optional, enables owner approvals
  apiKey: process.env.HALORA_API_KEY,
});

try {
  const result = await agent.pay({ to: 'G...', amount: 2_500_000n, reason: 'API credits' });
  if (result.status === 'paid') console.log(result.txHash);
  else console.log('waiting for owner approval', result.approvalId);
} catch (err) {
  if (err instanceof HaloraPolicyError) console.log(err.code, err.message);
  else throw err;
}
```

For direct payments the agent's own `G...` account is the transaction source and pays the network fee, so it must exist and hold a little XLM.

### 3. Agent: pay for x402 resources

```ts
const res = await agent.fetch('https://api.example.com/premium-data');
const data = await res.json();
```

On HTTP 402 with an x402 v2 `PAYMENT-REQUIRED` header, the SDK picks the Stellar `exact` option for the policy token, checks the policy, signs only the Soroban authorization entry for `transfer(account, payTo, amount)` and retries once with `PAYMENT-SIGNATURE`. The facilitator submits the transaction and pays the fee, so in this mode the agent needs no XLM and its `G...` account does not need to exist.

### 4. Approvals above the threshold

Payments above `approvalThreshold` need the owner. The pilot uses on-chain pre-approval (interfaces.md section 1):

1. `agent.pay(...)` fails pre-flight with `ApprovalRequired`. With `apiUrl` and `apiKey` set, the SDK creates an approval request (`POST /v1/approvals`) and returns `{ status: 'approval_pending', approvalId }`. Without the API it throws `HaloraPolicyError('ApprovalRequired')`.
2. The owner approves in the dashboard, which calls `approve_payment(to, amount, expires_at)` on-chain (`HaloraClient.approvePayment`) and posts the transaction hash to the API.
3. `agent.waitForApproval(approvalId)` polls `GET /v1/approvals/:id`. Once `approved`, it retries the same payment, which consumes the one-time pre-approval. Rejected, expired or timed-out requests throw `HaloraApprovalError`.

x402 payments above the threshold are refused unless a valid on-chain pre-approval for that `payTo` already exists, because x402 authorizations expire in about one minute.

## Errors

| Class                    | When                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `HaloraPolicyError`      | Pre-flight denial or a denial raised by the account contract. `code` is the contract error name (`Paused`, `PerTxLimitExceeded`, ...). |
| `HaloraTransactionError` | Simulation or submission failed for another reason (network, token balance, timeout).                                                  |
| `HaloraApiError`         | The Halora API returned an error.                                                                                                      |
| `HaloraApprovalError`    | An approval was rejected, expired, or polling timed out.                                                                               |
| `x402.X402Error`         | No acceptable x402 option, unsupported version, or a non-replayable request body.                                                      |

The pre-flight check reads policy, `spent_today` and any pre-approval from the contract and evaluates them locally (`evaluateAgentPayment` in `@halora/shared`). If any of that state cannot be read, the payment is not signed (fail closed). A passing pre-flight is not a guarantee: before submitting, the SDK simulates the signed transaction in enforcing mode, which runs `__check_auth` on the network.

## How agent signatures are encoded

The account's `__check_auth` takes a `HaloraSignature` enum. Using standard Soroban `#[contracttype]` encoding, the agent's credential `signature` ScVal is:

```
Vec[
  Symbol("Agent"),
  Map{
    Symbol("public_key"): Bytes(32),   // raw ed25519 public key
    Symbol("signature"):  Bytes(64),   // ed25519 signature
  }
]
```

`Owner(Signature)` uses `Symbol("Owner")`. `AgentWithOwner(agent, owner)` is `Vec[Symbol("AgentWithOwner"), Map{...agent}, Map{...owner}]`. Map keys are sorted, as Soroban requires.

The signed message is the standard Soroban authorization payload, `sha256(HashIdPreimage)`, built from the network ID, nonce, signature expiration ledger and invocation tree. For CAP-71 V2 address credentials the preimage is the address-bound variant. The SDK uses `@stellar/stellar-sdk`'s `authorizeEntry` and `buildAuthorizationEntryPreimage`, so both the legacy and the V2 credential arms are handled, and the credential arm returned by simulation is preserved.

Helpers: `encodeHaloraSignature`, `decodeHaloraSignature`, `getAuthEntryPayload`, `signHaloraAuthEntry`, and, for direct owner co-signing, `coSignAuthEntryAsOwner` and `attachOwnerSignature` (for wallets that sign a 32-byte payload).

## Transaction flow

1. Build `token.transfer(from = account, to, amount)` (or an owner method on the account).
2. Simulate in recording mode to obtain the authorization entry and nonce.
3. Sign the account's entry with the agent key (`Agent`) or owner key (`Owner`). Any other required authorization causes a refusal.
4. Simulate again in enforcing mode with the signed entry. This runs `__check_auth` and yields a footprint that includes the account's own storage writes (`spent_today`, approvals).
5. Assemble, sign the envelope with the fee payer, submit, and poll for the result.

## x402 support: what is verified and what is not

Verified against the x402 specification in `coinbase/x402` (read 2026-10-16):

- x402 v2 HTTP transport: `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE` headers carrying base64 JSON.
- The Stellar `exact` scheme (`specs/schemes/exact/scheme_exact_stellar.md`): v2 only, networks `stellar:testnet` and `stellar:pubnet`, SEP-41 tokens only, client signs only the auth entries, `payload.transaction` is a base64 transaction XDR with one `invokeHostFunction` calling `transfer(from, to, amount)`, auth expiry `currentLedger + ceil(maxTimeoutSeconds / 5)`, `extra.areFeesSponsored` currently always true, and C-accounts are supported through auth-entry signing.

Unverified (not yet tested against a live facilitator):

- That production facilitators (for example the OpenZeppelin Relayer based "Built on Stellar" facilitator) accept a custom-account payer whose `__check_auth` expects `HaloraSignature` rather than a plain ed25519 signature. The spec allows C-accounts; facilitator behavior is not confirmed.
- That Soroban RPC simulates correctly when the transaction source (the agent `G...` account) does not exist on-chain. The SDK falls back to sequence 0 in x402 mode; the facilitator rebuilds with its own source anyway.
- The exact text format of RPC simulation errors. The SDK maps a contract error to `HaloraPolicyError` only when a diagnostic line names the account contract (`contract:C..., ... Error(Contract, #N)`); otherwise it reports a generic `HaloraTransactionError`. Either way nothing is paid.
- Network protocol status (Protocol 27 on mainnet, Protocol 28 activation of V2 credentials) is taken from project notes and the spec text, not independently confirmed.

The x402 code is isolated in `apps/sdk/src/x402/` behind the `X402PaymentSigner` interface (`select`, `createPayload`), so the transport can be reused with another scheme.

## Security notes

- The agent secret is only used in memory to sign. It is never logged, never sent to the API, and never included in error messages.
- The API key is only sent to `apiUrl` over HTTPS (plain HTTP is allowed only for `localhost`).
- `HaloraClient` fails closed on mainnet without an explicit `rpcUrl`, on a missing WASM hash, and on unexpected authorization requirements.
- The SDK limits damage if the agent misbehaves; it does not protect a leaked agent key. The policy, enforced on-chain by the account contract, does.
