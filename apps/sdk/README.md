# @halora/sdk

TypeScript SDK for Halora: deploy and configure policy-bound agent accounts, sign agent payments, pay x402 resources, and request owner approvals. Built on `@stellar/stellar-sdk` 17.

Full guide and quickstart: [`docs/sdk/README.md`](../../docs/sdk/README.md). Interface contract: [`docs/architecture/interfaces.md`](../../docs/architecture/interfaces.md) section 4.

## Main exports

- `HaloraClient`: `deployAccount`, `getPolicy`, `getSpentToday`, `getApproval`, `getBalance`, `getOwner`, `getAgent`, `setPolicy`, `setAgent`, `pause`, `unpause`, `approvePayment`, `revokeApproval`.
- `HaloraAgent`: `pay`, `fetch` (x402-aware), `waitForApproval`, `preflight`, `signX402`.
- Auth helpers: `signHaloraAuthEntry`, `getAuthEntryPayload`, `coSignAuthEntryAsOwner`, `attachOwnerSignature`, `describeTransferAuthEntry`, `keypairSigner`.
- Encoding: `encodeHaloraSignature`, `decodeHaloraSignature`, `encodePolicy`, `decodePolicy`, `encodeApproval`, `decodeApproval`.
- Errors: `HaloraPolicyError` (re-exported from `@halora/shared`), `HaloraSdkError`, `HaloraTransactionError`, `HaloraApiError`, `HaloraApprovalError`.
- `x402` namespace: header codecs, `createX402Fetch`, the `X402PaymentSigner` interface and Stellar `exact` helpers.

## Layout

```
src/
  client.ts    HaloraClient (owner side, views)
  agent.ts     HaloraAgent (payments, approvals, x402)
  invoke.ts    record-simulate, sign, enforce-simulate, submit
  auth.ts      Soroban auth entry signing with HaloraSignature
  scval.ts     contract type encoding (Policy, HaloraSignature, Approval)
  tx.ts        RPC interface, simulation, submission and polling
  api.ts       Halora API client (approvals)
  x402/        x402 v2 HTTP transport and the Stellar exact scheme
test/          unit tests against an in-memory fake RPC and account model (no network)
```

## Scripts

```bash
bun run typecheck   # tsc --noEmit (src and test)
bun run lint        # eslint 9 flat config with typescript-eslint
bun run test        # bun test, no network access
bun run build       # tsc to dist/ (src only)
```

Tests inject a `HaloraRpc` (the subset of `rpc.Server` the SDK uses) and a `fetch` implementation, so they never touch the network.
