# Testnet deployment

Last run: 2026-10-19, Stellar CLI 28.1.0, protocol live on testnet that day.

## Addresses

| What                                                      | Value                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `halora-account` WASM hash (sha256)                       | `4df8f36cf2017943b0c1dbf30fa31b71c7df45c17dc9f3c9a858e709d211c5ff` (18,309 bytes, `stellar contract build`)                                                             |
| WASM upload transaction                                   | [`c1c155f9...ca66`](https://stellar.expert/explorer/testnet/tx/c1c155f98a154103f497699eb856fa745f37f0921bf671bbe4bb47a77f32ca66)                                        |
| Demo account (owner `halora-owner`, agent `halora-agent`) | [`CDVQYINUKCVPGE4S2TLQUIASQJCMTEBOVPHOR6V46C7M3FZP7ZWZM63X`](https://stellar.expert/explorer/testnet/contract/CDVQYINUKCVPGE4S2TLQUIASQJCMTEBOVPHOR6V46C7M3FZP7ZWZM63X) |
| USDC SAC (testnet)                                        | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`                                                                                                              |
| XLM SAC (testnet, token of the demo policy)               | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`                                                                                                              |

The WASM hash and USDC address are the source of truth in `apps/shared/src/contracts.testnet.json`. Each agent gets its own account instance, so the demo account is an example, not a shared deployment.

## Demo policy

Token XLM SAC; per payment 5 XLM; daily 20 XLM; approval above 2 XLM; allowlist = the `halora-merchant` key; expiry 30 days after deployment.

## End-to-end result (2026-10-19)

| Step                                                                 | Result                                               | Evidence                                                                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Agent pays 1 XLM within the policy                                   | Settled                                              | [`98a71503...ea27`](https://stellar.expert/explorer/testnet/tx/98a715034cd698f5d5c7675241c4a72447da3e39965abe28121b766de0fcea27) |
| Agent pays 3 XLM (above the 2 XLM threshold)                         | Held by the SDK pre-flight: `ApprovalRequired`       | No transaction                                                                                                                   |
| Owner calls `approve_payment` for 3 XLM                              | Approved on-chain                                    | [`ebabbfdc...a40e`](https://stellar.expert/explorer/testnet/tx/ebabbfdc6e988598384705c676caa449b072b070e24fa3e7fdd10eb01318a40e) |
| Agent pays 3 XLM again                                               | Settled; approval consumed (`approval(to)` is empty) | [`e9622b76...a132`](https://stellar.expert/explorer/testnet/tx/e9622b7665575eb08ff97f0a2e8fc9a091baeb13a5fede9b643d6b678b3da132) |
| Agent pays 10 XLM with the SDK pre-flight bypassed                   | **Refused by the contract**: `PerTxLimitExceeded`    | Simulation failure                                                                                                               |
| Agent pays 1 XLM to a key outside the allowlist, pre-flight bypassed | **Refused by the contract**: `RecipientNotAllowed`   | Simulation failure                                                                                                               |
| `spent_today` after two runs                                         | 8 XLM (1 + 3 per run)                                | View call                                                                                                                        |

## x402 through a public facilitator (2026-10-19)

`apps/sdk/scripts/x402-e2e.ts` runs a minimal x402 v2 resource server that charges 0.5 XLM and delegates verification and settlement to the public facilitator at `https://x402.org/facilitator` (`exact` scheme on `stellar:testnet`, fees sponsored).

| Step                                                                                              | Result                                                    | Evidence                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `agent.fetch('/forecast')` gets HTTP 402, signs only the auth entry with `HaloraSignature::Agent` | Payload sent                                              | No XLM needed by the agent                                                                                                       |
| Facilitator `/verify`                                                                             | `isValid: true`, payer = the Halora account               | Response logged                                                                                                                  |
| Facilitator `/settle`                                                                             | Settled                                                   | [`63ddfed1...c01d`](https://stellar.expert/explorer/testnet/tx/63ddfed18c80bf335075a0f0cb8b88e233dd22aeba5b27d2f95cc4cf63edc01d) |
| Resource returned                                                                                 | HTTP 200 with the forecast; `spent_today` rose by 0.5 XLM |                                                                                                                                  |
| `agent.fetch('/report')` priced at 10 XLM (per payment limit 5)                                   | Refused before signing: `PerTxLimitExceeded`              |                                                                                                                                  |

Not covered yet: USDC as the policy token (needs Circle's testnet faucet) and the OpenZeppelin facilitator (needs an API key).

## Reproduce

```bash
brew install stellar-cli
stellar keys generate halora-owner --network testnet --fund
stellar keys generate halora-agent --network testnet --fund
stellar keys generate halora-merchant --network testnet --fund
scripts/testnet/deploy.sh                                   # new demo account
HALORA_CONTRACT_ID=C... scripts/testnet/deploy.sh           # rerun against an existing one
```

The script builds and uploads the WASM, deploys an account through `@halora/sdk`, funds it with 30 XLM and runs `apps/sdk/scripts/testnet-e2e.ts`. Secrets are read from the Stellar CLI keystore into environment variables and never printed; the last run's public results are written to `scripts/testnet/last-run.json`.
