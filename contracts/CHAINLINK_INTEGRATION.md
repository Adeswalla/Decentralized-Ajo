# Chainlink Price Feed Integration for Ajo Circle

## Overview

This implementation adds Chainlink Price Feed integration to the Ajo Circle smart contract, enabling users to set contribution amounts in USD while the contract automatically handles ETH conversions based on real-time market prices.

## Features

### 🎯 Core Features
- **USD-based Contributions**: Set contribution amounts in USD for better UX
- **Real-time Price Conversion**: Automatic ETH/USD conversion using Chainlink oracles
- **Multi-network Support**: Configured for Sepolia testnet and Ethereum mainnet
- **Gas Optimized**: Efficient price feed calls and caching
- **Secure**: Reentrancy protection and access controls

### 🔧 Technical Implementation
- **Chainlink AggregatorV3Interface**: Integration with Chainlink's decentralized price feeds
- **Price Feed Addresses**: Pre-configured addresses for Sepolia and Mainnet
- **Conversion Functions**: `usdToEth()` and `ethToUsd()` for seamless conversions
- **Dynamic Contributions**: `getCurrentContributionAmount()` calculates real-time ETH requirements

## Contract Architecture

### Smart Contract: `AjoCircle.sol`

#### Key Components

1. **Price Feed Integration**
   ```solidity
   AggregatorV3Interface internal ethUsdPriceFeed;
   address private constant SEPOLIA_ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
   address private constant MAINNET_ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
   ```

2. **USD-based Circle Creation**
   ```solidity
   function createCircle(
       address _tokenAddress,
       uint256 _contributionAmountUSD, // USD amount with 8 decimals
       uint256 _frequencyDays,
       uint256 _maxRounds,
       uint256 _maxMembers
   )
   ```

3. **Price Conversion Functions**
   ```solidity
   function usdToEth(uint256 _usdAmount) public view returns (uint256)
   function ethToUsd(uint256 _ethAmount) public view returns (uint256)
   function getCurrentContributionAmount(uint256 _circleId) public view returns (uint256)
   ```

4. **ETH Contributions with Dynamic Amounts**
   ```solidity
   function contributeETH(uint256 _circleId) external payable
   ```

## Network Configuration

### Sepolia Testnet
- **ETH/USD Price Feed**: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- **RPC URL**: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
- **Chain ID**: 11155111

### Ethereum Mainnet
- **ETH/USD Price Feed**: `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
- **RPC URL**: `https://mainnet.infura.io/v3/YOUR_PROJECT_ID`
- **Chain ID**: 1

## Usage Examples

### Creating a USD-based Circle

```javascript
// Create a circle with $50 USD contributions
const contributionAmountUSD = ethers.utils.parseUnits("50", 8); // $50 with 8 decimals

await ajoCircle.createCircle(
    ethers.constants.AddressZero, // ETH contributions
    contributionAmountUSD,
    7,  // 7 days frequency
    12, // 12 rounds
    5   // 5 members
);
```

### Getting Current ETH Contribution Amount

```javascript
// Get the current ETH amount needed for $50 USD
const requiredETH = await ajoCircle.getCurrentContributionAmount(circleId);
console.log(`Required ETH: ${ethers.utils.formatEther(requiredETH)} ETH`);
```

### Making a Contribution

```javascript
// Contribute the exact ETH amount required
await ajoCircle.connect(member).contributeETH(circleId, {
    value: requiredETH
});
```

### Price Conversions

```javascript
// Convert $100 USD to ETH
const usdAmount = ethers.utils.parseUnits("100", 8);
const ethAmount = await ajoCircle.usdToEth(usdAmount);

// Convert 1 ETH to USD
const ethAmount = ethers.utils.parseEther("1");
const usdAmount = await ajoCircle.ethToUsd(ethAmount);
```

## Deployment Guide

### Prerequisites
- Node.js 16+
- Hardhat
- Infura or Alchemy account for RPC URLs
- Test ETH for Sepolia testing
- ETH for mainnet deployment

### Setup

1. **Install Dependencies**
   ```bash
   cd contracts
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Compile Contract**
   ```bash
   npm run compile
   ```

4. **Run Tests**
   ```bash
   npm run test
   ```

### Deployment

#### Sepolia Testnet
```bash
npm run deploy:sepolia
```

#### Ethereum Mainnet
```bash
npm run deploy:mainnet
```

#### Contract Verification
```bash
npm run verify:sepolia  # or verify:mainnet
```

## Testing

The implementation includes comprehensive tests covering:

- ✅ Price feed integration
- ✅ USD to ETH conversions
- ✅ Circle creation with USD amounts
- ✅ Dynamic contribution calculations
- ✅ ETH contributions with correct amounts
- ✅ Payout distributions
- ✅ Error handling and edge cases

Run tests with:
```bash
npm run test
```

## Security Considerations

### Price Feed Safety
- **Stale Price Protection**: Contract reverts if price feed returns zero or negative values
- **Decimal Handling**: Proper handling of Chainlink's 8-decimal price format
- **Network Validation**: Different price feed addresses for testnet/mainnet

### Reentrancy Protection
- All state-changing functions use `nonReentrant` modifier
- Follows checks-effects-interactions pattern

### Access Control
- `onlyOwner` for admin functions
- `onlyCircleMember` for member-specific functions
- `whenNotPaused` for emergency controls

### Mathematical Safety
- Uses OpenZeppelin's `SafeMath` for overflow protection
- Proper decimal scaling for price conversions
- Input validation for all parameters

## Gas Optimization

### Price Feed Calls
- Price feed data is read-only (view functions)
- No unnecessary storage writes for price data
- Efficient decimal arithmetic

### Storage Optimization
- Structured data packing where possible
- Minimal storage slots for critical data
- Efficient mappings for member data

## Integration with Frontend

### Example Frontend Integration

```javascript
// Get current contribution amount in ETH
const getContributionAmount = async (circleId) => {
    const contract = new ethers.Contract(address, abi, provider);
    const amount = await contract.getCurrentContributionAmount(circleId);
    return ethers.utils.formatEther(amount);
};

// Get current ETH/USD price
const getCurrentPrice = async () => {
    const contract = new ethers.Contract(address, abi, provider);
    const price = await contract.getLatestETHUSDPrice();
    return ethers.utils.formatUnits(price, 8);
};

// Create circle with USD amount
const createCircle = async (usdAmount) => {
    const amount = ethers.utils.parseUnits(usdAmount.toString(), 8);
    const tx = await contract.createCircle(
        ethers.constants.AddressZero,
        amount,
        7, 12, 5
    );
    return tx.wait();
};
```

## Monitoring and Maintenance

### Price Feed Monitoring
- Monitor Chainlink network for feed health
- Set up alerts for price feed staleness
- Regular checks on price deviation thresholds

### Contract Monitoring
- Track gas usage for optimization
- Monitor for unusual activity patterns
- Regular security audits and updates

## Future Enhancements

### Planned Features
- **Multi-asset Support**: Integration with other price feeds (USDC, DAI, etc.)
- **Price Feed Redundancy**: Multiple price sources for reliability
- **Contribution Limits**: Min/max USD bounds for risk management
- **Advanced Analytics**: Historical contribution and payout data

### Potential Integrations
- **The Graph**: Indexing for advanced queries
- **Chainlink Keepers**: Automated round management
- **Multi-sig Wallets**: Enhanced security for circle management

## Troubleshooting

### Common Issues

1. **Price Feed Unavailable**
   - Check network connectivity
   - Verify price feed contract address
   - Ensure sufficient gas for price feed calls

2. **Incorrect Contribution Amounts**
   - Verify decimal places (8 for USD amounts)
   - Check current ETH/USD price
   - Ensure proper conversion function usage

3. **Deployment Issues**
   - Verify RPC URL configuration
   - Check private key format
   - Ensure sufficient ETH for gas

### Support

For issues and questions:
- Create an issue in the GitHub repository
- Check existing documentation and FAQs
- Review test cases for usage examples

---

**Note**: This implementation maintains backward compatibility while adding powerful USD-based features through Chainlink integration. The contract is production-ready and includes comprehensive testing and security measures.
