# @halora/shared

Types, zod schemas, constants and contract IDs shared by every Halora TypeScript workspace. Canonical definitions live in [`docs/architecture/interfaces.md`](../../docs/architecture/interfaces.md) section 2; this package implements them.

The only runtime dependency is `zod`. The package exports TypeScript source (`src/index.ts`) for use inside the Bun monorepo; `bun run build` also emits `dist/` with `tsc`.

## Exports

| Area              | Exports                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schemas and types | `PolicySchema`/`Policy`, `AgentAccountSchema`/`AgentAccount`, `PaymentRecordSchema`/`PaymentRecord`, `ApprovalStatusSchema`/`ApprovalStatus`, `ApprovalRequestSchema`/`ApprovalRequest`, `OnChainApprovalSchema`/`OnChainApproval`, `PaymentResultSchema`/`PaymentResult`, `ApprovalPendingSchema`/`ApprovalPending`, `HaloraErrorCodeSchema` |
| API bodies        | `RegisterAccountBodySchema`, `CreateApprovalBodySchema`, `ApproveApprovalBodySchema`, `RejectApprovalBodySchema`, `ListApprovalsQuerySchema`                                                                                                                                                                                                  |
| Primitives        | `AmountSchema`, `PositiveAmountSchema`, `AccountIdSchema`, `ContractIdSchema`, `AddressSchema`, `NetworkSchema`, `TxHashSchema`, `IsoDateTimeSchema`, `UnixSecondsSchema`                                                                                                                                                                     |
| Errors            | `HALORA_ERROR_CODES`, `HALORA_ERRORS` (code, name, English message), `haloraErrorFromCode`, `parseHaloraContractError`, `HaloraPolicyError`, `isHaloraPolicyError`, `isHaloraErrorCode`                                                                                                                                                       |
| Policy            | `evaluateAgentPayment` (local mirror of `__check_auth`), `isUsableApproval`, `validatePolicy` (mirrors `InvalidPolicy`), `remainingDailyAllowance`, `utcDayBucket`                                                                                                                                                                            |
| Amounts           | `parseAmount`, `formatAmount`, `parseUsdc`, `formatUsdc`, `isBaseUnitString`, `baseUnitsToBigInt`, `bigIntToBaseUnits`, `AmountError`                                                                                                                                                                                                         |
| Strkeys           | `isAccountId`, `isContractId`, `isStellarAddress`, `isSecretSeed`, `decodeStrkey`, `encodeStrkey`, `publicKeyHexToAccountId`, `accountIdToPublicKeyHex`                                                                                                                                                                                       |
| Constants         | `NETWORKS`, `NETWORK_PASSPHRASES`, `DEFAULT_RPC_URLS`, `DEFAULT_HORIZON_URLS`, `FRIENDBOT_URL`, `USDC_DECIMALS`, `USDC_ISSUERS`, `MAX_ALLOWLIST_LENGTH`, `I128_MAX`, `SECONDS_PER_DAY`, `API_BASE_PATH`, `resolveRpcUrl`, `isNetwork`                                                                                                         |
| Contracts         | `CONTRACTS`, `getContracts`, `requireContract`; raw JSON at `@halora/shared/contracts.testnet.json` and `@halora/shared/contracts.mainnet.json`                                                                                                                                                                                               |

Notes:

- Amounts are integer base-unit strings in JSON, `bigint` in code. `parseAmount` rejects extra decimals instead of rounding.
- `DEFAULT_RPC_URLS.mainnet` is `null`: there is no default public mainnet Soroban RPC, so `resolveRpcUrl('mainnet')` throws unless you pass a URL.
- Contract IDs are data. Empty strings in the JSON files mean "not deployed yet"; `requireContract` throws on them.
- Strkey validation is dependency-free (base32 plus CRC16-XModem checksum) and cross-checked against `@stellar/stellar-sdk` in the SDK tests.

## Scripts

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint 9 flat config with typescript-eslint
bun run test        # bun test
bun run build       # tsc to dist/
```
