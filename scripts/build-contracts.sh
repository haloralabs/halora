#!/usr/bin/env bash
# Builds the Soroban contracts in apps/contracts.
#
# Usage:
#   scripts/build-contracts.sh                  release build with the Stellar CLI (deployable)
#   scripts/build-contracts.sh --compile-check  wasm compile check with plain cargo (NOT deployable)
#
# soroban-sdk 29 requires its build system to "shake" the contract spec, which only the
# Stellar CLI (v25.2.0+) does. A plain `cargo build --target wasm32v1-none` refuses to run
# unless SOROBAN_SDK_BUILD_SYSTEM_SUPPORTS_SPEC_SHAKING_V2 is set, and the wasm it produces
# then carries an unshaken spec. That artifact is only good for proving the code compiles to
# wasm. Never deploy it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT/apps/contracts"
TARGET="wasm32v1-none"
MODE="release"

case "${1:-}" in
  "") ;;
  --compile-check) MODE="compile-check" ;;
  -h | --help)
    sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "error: unknown argument '$1' (try --help)" >&2
    exit 2
    ;;
esac

# Prefer a cargo on PATH; fall back to rustup (Homebrew installs rustup without cargo proxies).
if command -v cargo >/dev/null 2>&1; then
  CARGO=(cargo)
elif command -v rustup >/dev/null 2>&1; then
  # rustup run needs rustc on PATH for build scripts; the Homebrew keg ships the proxies.
  if [ -d /opt/homebrew/opt/rustup/bin ]; then
    export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
  fi
  CARGO=(rustup run stable cargo)
else
  echo "error: neither cargo nor rustup found on PATH" >&2
  exit 1
fi

cd "$CONTRACTS_DIR"

if [ "$MODE" = "release" ]; then
  if ! command -v stellar >/dev/null 2>&1; then
    echo "error: the Stellar CLI (stellar, v25.2.0+) is required for a deployable build." >&2
    echo "       Install it, or run with --compile-check to only verify the wasm compiles." >&2
    exit 1
  fi
  stellar contract build
  OUT_DIR="$CONTRACTS_DIR/target/$TARGET/release"
  echo "Deployable wasm:"
else
  echo "warning: --compile-check produces an unshaken contract spec. Do not deploy this wasm." >&2
  SOROBAN_SDK_BUILD_SYSTEM_SUPPORTS_SPEC_SHAKING_V2=1 \
    "${CARGO[@]}" build --release --target "$TARGET"
  OUT_DIR="$CONTRACTS_DIR/target/$TARGET/release"
  echo "Compile-check wasm (not deployable):"
fi

shopt -s nullglob
artifacts=("$OUT_DIR"/*.wasm)
if [ ${#artifacts[@]} -eq 0 ]; then
  echo "error: no wasm produced in $OUT_DIR" >&2
  exit 1
fi
for wasm in "${artifacts[@]}"; do
  size=$(wc -c <"$wasm" | tr -d ' ')
  hash=$(shasum -a 256 "$wasm" | cut -d' ' -f1)
  echo "  $(basename "$wasm")  ${size} bytes  sha256 ${hash}"
done
