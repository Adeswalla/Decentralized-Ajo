# Multisig Setup Script for Windows PowerShell
# This script sets up the multisig authorization system

Write-Host "🔐 Setting up Multisig Authorization System..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate Prisma Client
Write-Host "📦 Step 1: Generating Prisma Client..." -ForegroundColor Yellow
try {
    & npx prisma generate
    if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed" }
    Write-Host "✅ Prisma client generated" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to generate Prisma client: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Run Database Migration
Write-Host "🗄️  Step 2: Running database migration..." -ForegroundColor Yellow
try {
    & npx prisma migrate dev --name add_multisig_support
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Migration failed, trying db push..." -ForegroundColor Yellow
        & npx prisma db push
        if ($LASTEXITCODE -ne 0) { throw "Database update failed" }
    }
    Write-Host "✅ Database updated" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to update database: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Verify Schema
Write-Host "🔍 Step 3: Verifying schema..." -ForegroundColor Yellow
try {
    & npx prisma validate
    if ($LASTEXITCODE -ne 0) { throw "Schema validation failed" }
    Write-Host "✅ Schema validated" -ForegroundColor Green
} catch {
    Write-Host "❌ Schema validation failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "✨ Multisig setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review MULTISIG_QUICKSTART.md for usage examples"
Write-Host "2. Run tests: npm test __tests__/api/multisig.test.ts"
Write-Host "3. Configure multisig for your circles via API or UI"
Write-Host ""
