#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT_DIR="$ROOT_DIR/contracts/ajo-circle"

cd "$CONTRACT_DIR"

echo "[bench] building release wasm"
cargo build --target wasm32-unknown-unknown --release

echo "[bench] running contract unit tests"
cargo test --lib

echo "[bench] done"
