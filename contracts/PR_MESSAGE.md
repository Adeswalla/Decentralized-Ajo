#115 Implement Withdrawal Function in Smart Contract

## Summary
Implemented a comprehensive withdrawal system that allows designated winners to withdraw collected pools for specific cycles in the Decentralized-Ajo smart contract.

## Features Added

### 1. Winner Designation System
- `designateWinner()` function for organizers to assign winners per cycle
- Validation to ensure only circle members can be designated
- Prevention of duplicate designations

### 2. Secure Withdrawal Function
- `withdraw()` function with comprehensive security checks:
  - Cycle maturity verification (time-based)
  - Pool funding validation
  - Designated winner verification
  - Reentrancy protection
  - Double withdrawal prevention

### 3. Internal Tracking
- `cycleWinners` mapping to track designated winners per cycle
- `cycleWithdrawn` mapping to prevent double withdrawals
- Integration with existing round management system

### 4. View Functions
- `isCycleMatured()` - Check if cycle is ready for withdrawal
- `isPoolFullyFunded()` - Verify pool has sufficient funds
- `getCycleWinner()` - Get designated winner for a cycle
- `isCycleWithdrawn()` - Check withdrawal status

## Security Features
- ✅ Reentrancy protection using OpenZeppelin's ReentrancyGuard
- ✅ Access control (only designated winners can withdraw)
- ✅ Time-based maturity checks
- ✅ Pool funding validation
- ✅ Safe ether transfer patterns
- ✅ Event emission for transparency

## Testing
- Comprehensive test suite covering all scenarios
- Validation of access controls and security measures
- Edge case testing (insufficient funds, premature withdrawal, etc.)

## Backward Compatibility
- Fully compatible with existing ROSCA functionality
- Original `claimPayout()` function remains intact
- No breaking changes to existing interfaces

## Files Modified
- `contracts/AjoCircle.sol` - Main contract implementation
- `contracts/test/AjoCircle.test.js` - Added comprehensive tests
- `contracts/WITHDRAWAL_IMPLEMENTATION.md` - Documentation

Fixes #115
