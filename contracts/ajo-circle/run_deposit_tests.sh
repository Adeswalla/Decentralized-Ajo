#!/bin/bash

# Deposit Function Test Runner
# This script runs all deposit-related tests and generates coverage report

set -e

echo "=================================="
echo "Deposit Function Test Suite"
echo "=================================="
echo ""

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Error: cargo is not installed"
    echo "Please install Rust: https://rustup.rs/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Error: Cargo.toml not found"
    echo "Please run this script from contracts/ajo-circle directory"
    exit 1
fi

echo "📦 Building contract..."
cargo build --target wasm32-unknown-unknown --release

echo ""
echo "🧪 Running deposit tests..."
echo ""

# Run all deposit tests
cargo test deposit -- --nocapture

echo ""
echo "=================================="
echo "✅ All deposit tests completed!"
echo "=================================="
echo ""

# Optional: Generate coverage report if tarpaulin is installed
if command -v cargo-tarpaulin &> /dev/null; then
    echo "📊 Generating coverage report..."
    cargo tarpaulin --out Html --output-dir coverage --tests -- deposit
    echo "Coverage report generated in coverage/index.html"
else
    echo "💡 Tip: Install cargo-tarpaulin for coverage reports:"
    echo "   cargo install cargo-tarpaulin"
fi
