# Backlog

Every planned issue for the MVP, with the cycle it is scheduled in. Issue IDs are stable; copy them into GitHub issues when the repo is public (HAL-001). Done-when is the acceptance check.

| ID      | Cycle  | Workstream | Issue                                                                                        | Done when                                                            |
| ------- | ------ | ---------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| HAL-001 | C1     | Platform   | Create GitHub org and public repo, push history, enable branch protection                    | Repo public, main protected, CI required                             |
| HAL-002 | C1     | Platform   | Run all seven CI workflows on GitHub and fix anything local runs hid                         | All workflows green on main                                          |
| HAL-003 | C1     | Contracts  | Install the Stellar CLI and produce a deployable wasm with `stellar contract build`          | Release build reproducible, hash recorded                            |
| HAL-004 | C1     | Contracts  | Deploy halora-account to testnet and record IDs in contracts.testnet.json                    | Contract ID and wasm hash committed                                  |
| HAL-005 | C1     | Grant      | Send the SCF interest form (Open Track) and ask for a referral code                          | Confirmation email received                                          |
| HAL-006 | C1     | Product    | Deploy the landing and demo dashboard (mock mode) to a public URL                            | URL in the SCF application                                           |
| HAL-007 | C1     | Grant      | Fill every [FOUNDER TO FILL] in scf-application.md: team, rates, AI disclosure, licence      | No placeholders left                                                 |
| HAL-008 | C2     | SDK        | x402 spike: pay a testnet x402 endpoint from a Halora account through the public facilitator | Recorded success and an over-limit rejection, or a written no-go     |
| HAL-009 | C2     | SDK        | Verify CAP-71 V2 credential signing and Freighter signAuthEntry for owner actions            | Result recorded in the verification matrix                           |
| HAL-010 | C2     | Grant      | Submit the SCF #46 Build application before Nov 8                                            | Submission confirmation                                              |
| HAL-011 | C2     | Contracts  | Confirm USDC SAC contract IDs on testnet and mainnet from a primary source                   | IDs in contracts JSON with source link                               |
| HAL-012 | C3     | SDK        | Run the SDK example scripts against testnet (deploy, setPolicy, pay, fetch)                  | Example script green in CI against testnet (nightly)                 |
| HAL-013 | C3     | SDK        | MCP core tools against testnet; record a Claude session paying and being refused             | Video published                                                      |
| HAL-014 | C3     | Grant      | Community vote support: Discord post, short demo video, thread                               | Posted before Nov 23                                                 |
| HAL-015 | C4     | Product    | Browser signer for owner actions in @halora/sdk (wallet signs the auth preimage)             | Webapp live mode uses the SDK signer, local reimplementation removed |
| HAL-016 | C4     | Platform   | Define and implement /v1/auth/challenge and /v1/auth/verify shapes in interfaces.md          | Webapp signs in with Freighter on staging                            |
| HAL-017 | C4     | Platform   | Deploy API and Postgres to staging; run migrations in CI                                     | Staging URL healthy                                                  |
| HAL-018 | C4     | Product    | Dashboard live mode end to end on testnet: create account, edit policy, pause                | M1 demo recorded                                                     |
| HAL-019 | C5     | Platform   | Add GET approvals by account (active on-chain pre-approvals list) to the API                 | Dashboard lists active approvals without probing recipients          |
| HAL-020 | C5     | Platform   | Indexer reconciliation test: 100 testnet payments, zero mismatches                           | Report committed                                                     |
| HAL-021 | C5     | Platform   | Owner notifications for approval requests (email or webhook)                                 | Notification received in under 30 s                                  |
| HAL-022 | C5     | Platform   | POST /v1/accounts/:id/api-key to rotate the agent API key                                    | Rotation works from the dashboard                                    |
| HAL-023 | C6     | Contracts  | STRIDE threat model and on-chain monitoring plan (SDF templates)                             | Published in docs/security                                           |
| HAL-024 | C6     | Contracts  | Property and fuzz tests on limit arithmetic and day rollover                                 | CI runs them on every PR                                             |
| HAL-025 | C6     | Grant      | Request the SCF Audit Bank slot                                                              | Request acknowledged                                                 |
| HAL-026 | C7     | Product    | Guided onboarding: create wallet, fund, connect agent, first payment                         | Internal time to first payment under 10 min                          |
| HAL-027 | C7     | Product    | Docs site with quickstart, SDK reference, MCP setup                                          | Public docs URL                                                      |
| HAL-028 | C7     | SDK        | Three example agents: direct pay, x402 fetch, MCP                                            | Examples run in CI                                                   |
| HAL-029 | C7     | Product    | English and Spanish (next-intl) for landing and dashboard                                    | Parity test green                                                    |
| HAL-030 | C7     | Product    | Persist the demo session across reloads                                                      | Reload keeps the demo owner                                          |
| HAL-031 | C8     | Grant      | Recruit 5 external developers for the testnet pilot                                          | 5 sessions booked                                                    |
| HAL-032 | C8     | Product    | Run pilot sessions, record time to first payment and issues                                  | Pilot findings report                                                |
| HAL-033 | C9     | Product    | Fix pilot findings ranked high                                                               | All high findings closed                                             |
| HAL-034 | C9     | Platform   | Written QA protocol and results for every end-to-end flow                                    | QA report committed                                                  |
| HAL-035 | C9     | Grant      | SCF T2 report: threat model, monitoring plan, testnet URL                                    | T2 submitted                                                         |
| HAL-036 | C10    | Contracts  | Audit and remediation of halora-account                                                      | Findings closed or documented                                        |
| HAL-037 | C10    | Platform   | Production infra: mainnet RPC provider, managed Postgres, secrets, uptime checks             | Runbook in docs/operations                                           |
| HAL-038 | C10    | Product    | Build the webapp with Turbopack (remove the .js import workaround)                           | Turbopack build green, or decision logged                            |
| HAL-039 | C11    | Contracts  | Mainnet deploy with guarded caps; publish wasm hash and verifiable build steps               | Mainnet contract live                                                |
| HAL-040 | C11    | SDK        | Publish @halora/sdk and @halora/mcp 1.0 to npm with provenance                               | Packages on npm                                                      |
| HAL-041 | C11    | Contracts  | Monitoring alerts live on mainnet contracts                                                  | Test alert received                                                  |
| HAL-042 | C12    | Product    | External onboarding QA on mainnet with 5 developers                                          | Time to first payment under 10 min                                   |
| HAL-043 | C12    | Grant      | Launch assets: demo video, post, docs announcement; SCF T3 package                           | Ready by Apr 4                                                       |
| HAL-044 | Launch | Grant      | Launch on Apr 15; 30-day guarded period starts                                               | Launch post live                                                     |

## Not scheduled (after the MVP)

- Confidential Tokens private payments (phase 2, gated on mainnet availability and audit).
- ML-DSA post-quantum owner and agent keys (phase 3, gated on CAP-87).
- Multiple tokens per policy, per-recipient limits, anomaly detection.
- OpenZeppelin-compatible policy contracts; Halora-run facilitator; hosted custody.
