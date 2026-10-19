# Cycle 04: Dashboard live mode, Testnet alpha (M1)

Dates: 2026-11-30 to 2026-12-13. Status: planned.

**Goal:** Dashboard live mode, Testnet alpha (M1).

**Demo at the end:** M1: create an agent wallet with Freighter and pay on testnet.

## Issues

- [ ] **HAL-015** (Product) Browser signer for owner actions in @halora/sdk (wallet signs the auth preimage). Done when: Webapp live mode uses the SDK signer, local reimplementation removed.
- [ ] **HAL-016** (Platform) Define and implement /v1/auth/challenge and /v1/auth/verify shapes in interfaces.md. Done when: Webapp signs in with Freighter on staging.
- [ ] **HAL-017** (Platform) Deploy API and Postgres to staging; run migrations in CI. Done when: Staging URL healthy.
- [ ] **HAL-018** (Product) Dashboard live mode end to end on testnet: create account, edit policy, pause. Done when: M1 demo recorded.

## Notes

Record decisions in `docs/strategy/decision-log.md` and external facts in `docs/strategy/integration-verification-matrix.md` before closing the cycle.
