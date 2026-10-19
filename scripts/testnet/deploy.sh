#!/usr/bin/env bash
# Testnet deployment of halora-account, then the end-to-end check through @halora/sdk.
#
#   scripts/testnet/deploy.sh            build, upload the WASM, deploy a demo account, fund it, run e2e
#   HALORA_CONTRACT_ID=C... scripts/testnet/deploy.sh   reuse an existing demo account
#
# Needs the Stellar CLI (brew install stellar-cli) and three testnet identities, created once:
#   stellar keys generate halora-owner --network testnet --fund
#   stellar keys generate halora-agent --network testnet --fund
#   stellar keys generate halora-merchant --network testnet --fund
# Keys stay in the Stellar CLI's local config. Nothing secret is printed or written to the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
XLM_SAC="$(stellar contract id asset --asset native --network testnet)"

./scripts/build-contracts.sh
WASM="apps/contracts/target/wasm32v1-none/release/halora_account.wasm"
HASH="$(stellar contract upload --wasm "$WASM" --source halora-owner --network testnet 2>/dev/null | tail -1)"
echo "wasm hash: $HASH"

export HALORA_OWNER_SECRET="$(stellar keys show halora-owner)"
export HALORA_AGENT_SECRET="$(stellar keys show halora-agent)"
export HALORA_MERCHANT="$(stellar keys public-key halora-merchant)"

if [ -z "${HALORA_CONTRACT_ID:-}" ]; then
  # First pass deploys the account and stops at the funding check.
  bun apps/sdk/scripts/testnet-e2e.ts || true
  HALORA_CONTRACT_ID="$(sed -n 's/.*"contractId": "\(C[A-Z0-9]*\)".*/\1/p' scripts/testnet/last-run.json 2>/dev/null || true)"
fi

if [ -n "${HALORA_CONTRACT_ID:-}" ]; then
  stellar contract invoke --id "$XLM_SAC" --source halora-owner --network testnet -- \
    transfer --from "$(stellar keys public-key halora-owner)" --to "$HALORA_CONTRACT_ID" --amount 300000000 >/dev/null
  echo "funded $HALORA_CONTRACT_ID with 30 XLM"
  HALORA_CONTRACT_ID="$HALORA_CONTRACT_ID" bun apps/sdk/scripts/testnet-e2e.ts
fi
