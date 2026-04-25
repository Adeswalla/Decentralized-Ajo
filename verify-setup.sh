#!/usr/bin/env bash

# AjoFactory Deployment Setup Verification Script
# This script verifies that all deployment files have been created correctly

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  AjoFactory Deployment Setup Verification                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize counters
total=0
found=0

# Function to check file exists
check_file() {
    local file=$1
    local description=$2
    total=$((total + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        echo "  → $file"
        found=$((found + 1))
    else
        echo -e "${RED}✗${NC} $description"
        echo "  → $file (NOT FOUND)"
    fi
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local description=$2
    total=$((total + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
        echo "  → $dir"
        found=$((found + 1))
    else
        echo -e "${RED}✗${NC} $description"
        echo "  → $dir (NOT FOUND)"
    fi
}

echo "📋 Checking configuration files..."
echo "─────────────────────────────────────────────────────────────────"
check_file "hardhat.config.ts" "Hardhat configuration"
check_file ".env.example" "Environment template"
check_file "tsconfig.json" "TypeScript configuration"
check_file "package.json" "Package configuration (with Hardhat scripts)"
echo ""

echo "📝 Checking smart contracts..."
echo "─────────────────────────────────────────────────────────────────"
check_file "contracts/ethereum/AjoFactory.sol" "AjoFactory smart contract"
echo ""

echo "🚀 Checking deployment scripts..."
echo "─────────────────────────────────────────────────────────────────"
check_file "scripts/deploy.ts" "Main deployment script"
check_file "scripts/check-deployment.ts" "Deployment status checker"
echo ""

echo "🧪 Checking test files..."
echo "─────────────────────────────────────────────────────────────────"
check_file "test/AjoFactory.test.ts" "Unit tests for AjoFactory"
echo ""

echo "📚 Checking utility files..."
echo "─────────────────────────────────────────────────────────────────"
check_file "lib/deployment-utils.ts" "Deployment utility functions"
echo ""

echo "📖 Checking documentation..."
echo "─────────────────────────────────────────────────────────────────"
check_file "DEPLOYMENT_SEPOLIA.md" "Complete deployment guide"
check_file "DEPLOYMENT_WORKFLOW.md" "Quick reference guide"
check_file "FRONTEND_INTEGRATION.md" "Frontend integration guide"
check_file "DEPLOYMENT_COMPLETE.md" "Setup summary"
echo ""

echo "📁 Checking directories..."
echo "─────────────────────────────────────────────────────────────────"
check_dir "contracts/ethereum" "Ethereum contracts directory"
check_dir "scripts" "Deployment scripts directory"
check_dir "test" "Test directory"
check_dir "frontend/constants/deployments" "Frontend deployment constants"
check_dir "deployments" "Local deployments tracking directory"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Verification Results                                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $found -eq $total ]; then
    echo -e "${GREEN}✅ All files and directories present!${NC}"
    echo "   ($found/$total items found)"
else
    echo -e "${YELLOW}⚠️  Some files are missing${NC}"
    echo "   ($found/$total items found)"
fi

echo ""
echo "📋 Next Steps:"
echo "─────────────────────────────────────────────────────────────────"
echo "1. Install dependencies:"
echo "   ${YELLOW}pnpm install${NC}"
echo ""
echo "2. Configure environment:"
echo "   ${YELLOW}cp .env.example .env${NC}"
echo "   Edit .env with your credentials"
echo ""
echo "3. Get testnet ETH:"
echo "   Visit: https://sepoliafaucet.com/"
echo ""
echo "4. Deploy to Sepolia:"
echo "   ${YELLOW}pnpm contract:deploy:sepolia${NC}"
echo ""
echo "5. Check deployment status:"
echo "   ${YELLOW}npx hardhat run scripts/check-deployment.ts --network sepolia${NC}"
echo ""
echo "6. Read documentation:"
echo "   - DEPLOYMENT_SEPOLIA.md (Complete guide)"
echo "   - DEPLOYMENT_WORKFLOW.md (Quick reference)"
echo "   - FRONTEND_INTEGRATION.md (Frontend guide)"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Ready to deploy! 🚀                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
