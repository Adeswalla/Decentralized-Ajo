#!/bin/bash

# Multisig Setup Script
# This script sets up the multisig authorization system

echo "🔐 Setting up Multisig Authorization System..."
echo ""

# Step 1: Generate Prisma Client
echo "📦 Step 1: Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi
echo "✅ Prisma client generated"
echo ""

# Step 2: Run Database Migration
echo "🗄️  Step 2: Running database migration..."
npx prisma migrate dev --name add_multisig_support
if [ $? -ne 0 ]; then
    echo "⚠️  Migration failed, trying db push..."
    npx prisma db push
    if [ $? -ne 0 ]; then
        echo "❌ Failed to update database"
        exit 1
    fi
fi
echo "✅ Database updated"
echo ""

# Step 3: Verify Schema
echo "🔍 Step 3: Verifying schema..."
npx prisma validate
if [ $? -ne 0 ]; then
    echo "❌ Schema validation failed"
    exit 1
fi
echo "✅ Schema validated"
echo ""

echo "✨ Multisig setup complete!"
echo ""
echo "Next steps:"
echo "1. Review MULTISIG_QUICKSTART.md for usage examples"
echo "2. Run tests: npm test __tests__/api/multisig.test.ts"
echo "3. Configure multisig for your circles via API or UI"
echo ""
