# Cycle 01: Public repo, testnet deploy, SCF interest form

Dates: 2026-10-19 to 2026-11-01. Status: in progress. GitHub: https://github.com/haloralabs/halora (issues HAL-001 to HAL-045 are #2 to #46).

**Goal:** Public repo, testnet deploy, SCF interest form.

**Demo at the end:** Contract ID on testnet and public landing URL.

## Issues

- [x] **HAL-001** (Platform) Create GitHub org and public repo, push history, enable branch protection. Done when: Repo public, main protected, CI required.
- [x] **HAL-002** (Platform) Run all seven CI workflows on GitHub and fix anything local runs hid. Done when: All workflows green on main.
- [x] **HAL-003** (Contracts) Install the Stellar CLI and produce a deployable wasm with `stellar contract build`. Done when: Release build reproducible, hash recorded.
- [x] **HAL-004** (Contracts) Deploy halora-account to testnet and record IDs in contracts.testnet.json. Done when: Contract ID and wasm hash committed.
- [ ] **HAL-005** (Grant) Send the SCF interest form (Open Track) and ask for a referral code. Done when: Confirmation email received.
- [x] **HAL-006** (Product) Deploy the landing and demo dashboard (mock mode) to a public URL. Done when: URL in the SCF application.
- [ ] **HAL-007** (Grant) Fill every [FOUNDER TO FILL] in scf-application.md: team, rates, AI disclosure, licence. Done when: No placeholders left.

## Notes

Record decisions in `docs/strategy/decision-log.md` and external facts in `docs/strategy/integration-verification-matrix.md` before closing the cycle.
