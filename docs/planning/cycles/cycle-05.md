# Cycle 05: Approvals end to end, indexer reconciliation

Dates: 2026-12-14 to 2026-12-27. Status: planned.

**Goal:** Approvals end to end, indexer reconciliation.

**Demo at the end:** Held payment approved from the dashboard.

## Issues

- [ ] **HAL-019** (Platform) Add GET approvals by account (active on-chain pre-approvals list) to the API. Done when: Dashboard lists active approvals without probing recipients.
- [ ] **HAL-020** (Platform) Indexer reconciliation test: 100 testnet payments, zero mismatches. Done when: Report committed.
- [ ] **HAL-021** (Platform) Owner notifications for approval requests (email or webhook). Done when: Notification received in under 30 s.
- [ ] **HAL-022** (Platform) POST /v1/accounts/:id/api-key to rotate the agent API key. Done when: Rotation works from the dashboard.

## Notes

Record decisions in `docs/strategy/decision-log.md` and external facts in `docs/strategy/integration-verification-matrix.md` before closing the cycle.
