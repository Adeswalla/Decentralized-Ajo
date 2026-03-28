# Deposit Function Test Runner (PowerShell)
# This script runs all deposit-related tests and generates coverage report

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Deposit Function Test Suite" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if cargo is installed
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: cargo is not installed" -ForegroundColor Red
    Write-Host "Please install Rust: https://rustup.rs/"
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "Cargo.toml")) {
    Write-Host "❌ Error: Cargo.toml not found" -ForegroundColor Red
    Write-Host "Please run this script from contracts/ajo-circle directory"
    exit 1
}

Write-Host "📦 Building contract..." -ForegroundColor Yellow
cargo build --target wasm32-unknown-unknown --release

Write-Host ""
Write-Host "🧪 Running deposit tests..." -ForegroundColor Yellow
Write-Host ""

# Run all deposit tests
cargo test deposit -- --nocapture

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "✅ All deposit tests completed!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# Optional: Generate coverage report if tarpaulin is installed
if (Get-Command cargo-tarpaulin -ErrorAction SilentlyContinue) {
    Write-Host "📊 Generating coverage report..." -ForegroundColor Yellow
    cargo tarpaulin --out Html --output-dir coverage --tests -- deposit
    Write-Host "Coverage report generated in coverage/index.html" -ForegroundColor Green
} else {
    Write-Host "💡 Tip: Install cargo-tarpaulin for coverage reports:" -ForegroundColor Cyan
    Write-Host "   cargo install cargo-tarpaulin"
}
