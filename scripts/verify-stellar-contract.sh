#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/contracts/ajo-circle"

echo "=== Stellar / Soroban contract verification checklist ==="
echo "1) Build WASM:"
echo "   cargo build --target wasm32-unknown-unknown --release"
echo ""
echo "2) Artifact path:"
echo "   $ROOT/contracts/ajo-circle/target/wasm32-unknown-unknown/release/ajo_circle.wasm"
echo ""
echo "3) After deploy, publish this WASM on your network explorer (e.g. Stellar Expert) with the same deploy args."
echo ""

if cargo build --target wasm32-unknown-unknown --release 2>/dev/null; then
  echo "Build OK:"
  ls -la target/wasm32-unknown-unknown/release/ajo_circle.wasm 2>/dev/null || true
else
  echo "Build failed — fix compile errors before verifying on-chain."
  exit 1
fi
