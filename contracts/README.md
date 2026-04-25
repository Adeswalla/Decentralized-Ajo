# Ethereum Ajo Circle Implementation

This directory contains the Ethereum implementation of the Ajo Circle smart contract with Chainlink Price Feed integration for USD-based contributions.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Infura/Alchemy URLs and private key
```

### 3. Compile Contract
```bash
npm run compile
```

### 4. Run Tests
```bash
npm run test
```

### 5. Deploy to Sepolia
```bash
npm run deploy:sepolia
```

## 📁 Project Structure

```
contracts/
├── AjoCircle.sol              # Main smart contract with Chainlink integration
├── hardhat.config.js           # Hardhat configuration
├── package.json                # Dependencies and scripts
├── scripts/
│   └── deploy.js               # Deployment script
├── test/
│   ├── AjoCircle.test.js       # Comprehensive test suite
│   └── MockPriceFeed.sol       # Mock price feed for testing
├── .env.example                # Environment variables template
└── CHAINLINK_INTEGRATION.md    # Detailed documentation
```

## 🎯 Key Features

### Chainlink Price Feed Integration
- **Real-time ETH/USD prices** from Chainlink oracles
- **USD-based contributions** for better user experience
- **Automatic conversions** between USD and ETH
- **Multi-network support** (Sepolia testnet & Ethereum mainnet)

### Smart Contract Features
- **Circle creation** with USD contribution amounts
- **Dynamic ETH calculations** based on current market prices
- **Secure contributions** with reentrancy protection
- **Automated payouts** with randomized order
- **Access control** and emergency functions

## 📊 Price Feed Details

### Network Addresses
- **Sepolia**: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- **Mainnet**: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`

### Key Functions
```solidity
// Get latest ETH/USD price
function getLatestETHUSDPrice() public view returns (int256)

// Convert USD to ETH
function usdToEth(uint256 _usdAmount) public view returns (uint256)

// Get current contribution amount in ETH
function getCurrentContributionAmount(uint256 _circleId) public view returns (uint256)
```

## 🔧 Usage Examples

### Creating a Circle with USD Contributions
```javascript
const contributionAmountUSD = ethers.utils.parseUnits("50", 8); // $50 USD

await ajoCircle.createCircle(
    ethers.constants.AddressZero, // ETH contributions
    contributionAmountUSD,
    7,  // 7 days frequency
    12, // 12 rounds
    5   // 5 members
);
```

### Making Contributions
```javascript
// Get current ETH requirement
const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);

// Contribute exact amount
await ajoCircle.connect(member).contributeETH(circleId, {
    value: requiredETH
});
```

## 🧪 Testing

The test suite covers:
- ✅ Price feed integration
- ✅ USD/ETH conversions
- ✅ Circle creation and management
- ✅ Contribution handling
- ✅ Payout distribution
- ✅ Error handling

## 📖 Documentation

See [CHAINLINK_INTEGRATION.md](./CHAINLINK_INTEGRATION.md) for comprehensive documentation including:
- Technical implementation details
- Security considerations
- Gas optimization
- Frontend integration examples
- Troubleshooting guide

## 🔐 Security

- **Reentrancy protection** on all state-changing functions
- **Access control** with owner-only functions
- **Price feed validation** to prevent stale/invalid prices
- **Input validation** for all parameters
- **Emergency pause** functionality

## 🌐 Networks

### Sepolia Testnet
- **Chain ID**: 11155111
- **Price Feed**: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- **Purpose**: Testing and development

### Ethereum Mainnet
- **Chain ID**: 1
- **Price Feed**: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
- **Purpose**: Production deployment

## 🚨 Important Notes

- **USD amounts use 8 decimals** (Chainlink standard)
- **ETH amounts use 18 decimals** (Ethereum standard)
- **Price feeds are read-only** and gas-efficient
- **Always verify** price feed addresses for your network
- **Test thoroughly** on Sepolia before mainnet deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the main repository for details.
