# Solidity Migration Guide

## Overview

This guide provides instructions for migrating the Ajo Circle contract from Stellar Soroban (Rust) to Ethereum (Solidity). The current implementation is fully functional on Stellar, but this guide helps if you need an Ethereum version.

## Why Migrate?

### Reasons to Stay on Stellar
- ✅ Lower transaction costs
- ✅ Built-in token standards
- ✅ Optimized for financial applications
- ✅ Higher throughput
- ✅ Simpler token integration

### Reasons to Migrate to Ethereum
- 🔄 Larger DeFi ecosystem
- 🔄 More developer tooling
- 🔄 Wider wallet support
- 🔄 Established audit firms
- 🔄 Existing integrations

## Setup Ethereum Development Environment

### 1. Install Hardhat
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

### 2. Install OpenZeppelin
```bash
npm install @openzeppelin/contracts
```

### 3. Project Structure
```
contracts/
├── ethereum/
│   ├── contracts/
│   │   ├── AjoCircle.sol
│   │   ├── AjoFactory.sol
│   │   └── interfaces/
│   │       └── IAjoCircle.sol
│   ├── test/
│   │   └── AjoCircle.test.js
│   ├── scripts/
│   │   └── deploy.js
│   └── hardhat.config.js
```

## Solidity Contract Template

### AjoCircle.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Ajo Circle
/// @notice Decentralized Rotating Savings and Credit Association (ROSCA)
/// @dev Implements a trustless group savings mechanism with rotating payouts
contract AjoCircle is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    uint256 public constant MAX_MEMBERS = 50;
    uint256 public constant HARD_CAP = 100;
    uint256 public constant PENALTY_PERCENTAGE = 10;

    // ═══════════════════════════════════════════════════════════════════════
    // ENUMS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Circle lifecycle states
    enum CircleStatus {
        Active,
        VotingForDissolution,
        Dissolved,
        Panicked
    }

    /// @notice Member status
    enum MemberStatus {
        Active,
        Inactive,
        Exited
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Core circle configuration
    /// @param organizer Circle administrator
    /// @param tokenAddress Token contract address (e.g., USDC)
    /// @param contributionAmount Required contribution per round
    /// @param frequencyDays Round duration in days
    /// @param maxRounds Total number of rounds
    /// @param currentRound Active round number (1-indexed)
    /// @param memberCount Current number of members
    /// @param maxMembers Maximum member capacity
    struct CircleData {
        address organizer;
        address tokenAddress;
        uint256 contributionAmount;
        uint256 frequencyDays;
        uint256 maxRounds;
        uint256 currentRound;
        uint256 memberCount;
        uint256 maxMembers;
    }

    /// @notice Individual member data
    /// @param memberAddress Member's wallet address
    /// @param totalContributed Cumulative contributions
    /// @param totalWithdrawn Cumulative withdrawals
    /// @param hasReceivedPayout Whether payout has been claimed
    /// @param status Member's current status
    struct MemberData {
        address memberAddress;
        uint256 totalContributed;
        uint256 totalWithdrawn;
        bool hasReceivedPayout;
        MemberStatus status;
    }

    /// @notice Member activity tracking
    /// @param missedCount Consecutive missed contributions
    /// @param isActive Eligibility status
    struct MemberStanding {
        uint256 missedCount;
        bool isActive;
    }

    /// @notice Dissolution vote tracking
    /// @param votesFor Number of YES votes
    /// @param totalMembers Total eligible voters
    /// @param thresholdMode 0 = majority, 1 = supermajority
    struct DissolutionVote {
        uint256 votesFor;
        uint256 totalMembers;
        uint256 thresholdMode;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    CircleData public circle;
    CircleStatus public circleStatus;
    DissolutionVote public dissolutionVote;

    mapping(address => MemberData) public members;
    mapping(address => MemberStanding) public standings;
    mapping(address => bool) public kycStatus;
    mapping(address => bool) public voteCast;
    mapping(address => uint256) public lastDepositAt;

    address[] public memberAddresses;
    address[] public rotationOrder;

    uint256 public roundDeadline;
    uint256 public roundContribCount;
    uint256 public totalPool;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event CircleInitialized(
        address indexed organizer,
        address indexed tokenAddress,
        uint256 contributionAmount,
        uint256 frequencyDays,
        uint256 maxRounds,
        uint256 maxMembers
    );

    event MemberJoined(address indexed member, uint256 memberCount);
    event ContributionMade(address indexed member, uint256 amount);
    event DepositMade(address indexed member, uint256 amount, uint256 timestamp);
    event PayoutClaimed(address indexed member, uint256 amount);
    event PartialWithdrawal(address indexed member, uint256 amount, uint256 penalty);
    event EmergencyRefund(address indexed member, uint256 amount);
    event DissolutionVoteStarted(address indexed initiator, uint256 thresholdMode);
    event VoteCast(address indexed member);
    event CircleDissolved();
    event PanicTriggered(address indexed admin);
    event MemberSlashed(address indexed member, uint256 missedCount);
    event MemberBooted(address indexed member);
    event KycStatusUpdated(address indexed member, bool isVerified);
    event RotationShuffled(uint256 memberCount);

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error NotFound();
    error Unauthorized();
    error AlreadyExists();
    error InvalidInput();
    error AlreadyPaid();
    error InsufficientFunds();
    error Disqualified();
    error VoteAlreadyActive();
    error NoActiveVote();
    error AlreadyVoted();
    error CircleNotActive();
    error CircleAlreadyDissolved();
    error CircleAtCapacity();
    error CirclePanicked();

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOrganizer() {
        if (msg.sender != circle.organizer) revert Unauthorized();
        _;
    }

    modifier onlyMember() {
        if (members[msg.sender].memberAddress == address(0)) revert NotFound();
        _;
    }

    modifier notPanicked() {
        if (circleStatus == CircleStatus.Panicked) revert CirclePanicked();
        _;
    }

    modifier onlyPanicked() {
        if (circleStatus != CircleStatus.Panicked) revert CircleNotActive();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Initialize a new Ajo circle
    /// @param _tokenAddress Token contract address
    /// @param _contributionAmount Required contribution per round
    /// @param _frequencyDays Round duration in days
    /// @param _maxRounds Total number of rounds
    /// @param _maxMembers Maximum member capacity (0 = default)
    constructor(
        address _tokenAddress,
        uint256 _contributionAmount,
        uint256 _frequencyDays,
        uint256 _maxRounds,
        uint256 _maxMembers
    ) Ownable(msg.sender) {
        if (_contributionAmount == 0) revert InvalidInput();
        if (_frequencyDays == 0) revert InvalidInput();
        if (_maxRounds == 0) revert InvalidInput();

        uint256 configuredMaxMembers = _maxMembers == 0 ? MAX_MEMBERS : _maxMembers;
        if (configuredMaxMembers > HARD_CAP) revert InvalidInput();

        circle = CircleData({
            organizer: msg.sender,
            tokenAddress: _tokenAddress,
            contributionAmount: _contributionAmount,
            frequencyDays: _frequencyDays,
            maxRounds: _maxRounds,
            currentRound: 1,
            memberCount: 1,
            maxMembers: configuredMaxMembers
        });

        circleStatus = CircleStatus.Active;
        roundDeadline = block.timestamp + (_frequencyDays * 1 days);

        // Add organizer as first member
        _addMember(msg.sender);

        emit CircleInitialized(
            msg.sender,
            _tokenAddress,
            _contributionAmount,
            _frequencyDays,
            _maxRounds,
            configuredMaxMembers
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Add a new member to the circle
    /// @param _newMember Address of the member to add
    function joinCircle(address _newMember) external onlyOrganizer notPanicked {
        if (members[_newMember].memberAddress != address(0)) revert AlreadyExists();
        if (circle.memberCount >= circle.maxMembers) revert CircleAtCapacity();

        _addMember(_newMember);
        circle.memberCount++;

        emit MemberJoined(_newMember, circle.memberCount);
    }

    /// @notice Make a contribution to the circle
    /// @param _amount Amount to contribute
    function contribute(uint256 _amount) external onlyMember notPanicked nonReentrant {
        if (_amount == 0) revert InvalidInput();

        MemberStanding storage standing = standings[msg.sender];
        if (standing.missedCount >= 3) revert Disqualified();
        if (!standing.isActive) revert Disqualified();

        // Reset missed count
        standing.missedCount = 0;

        // Transfer tokens
        IERC20(circle.tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        // Update member data
        MemberData storage member = members[msg.sender];
        uint256 roundTarget = circle.currentRound * circle.contributionAmount;
        bool hadCompletedRound = member.totalContributed >= roundTarget;

        member.totalContributed += _amount;

        bool hasCompletedRound = member.totalContributed >= roundTarget;

        // Check if round is complete
        if (!hadCompletedRound && hasCompletedRound) {
            roundContribCount++;

            if (roundContribCount >= circle.memberCount) {
                roundDeadline += circle.frequencyDays * 1 days;
                if (circle.currentRound < circle.maxRounds) {
                    circle.currentRound++;
                }
                roundContribCount = 0;
            }
        }

        emit ContributionMade(msg.sender, _amount);
    }

    /// @notice Deposit exact contribution amount
    function deposit() external onlyMember notPanicked nonReentrant {
        MemberStanding storage standing = standings[msg.sender];
        if (standing.missedCount >= 3) revert Disqualified();
        if (!standing.isActive) revert Disqualified();

        standing.missedCount = 0;

        uint256 amount = circle.contributionAmount;
        IERC20(circle.tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        MemberData storage member = members[msg.sender];
        member.totalContributed += amount;

        lastDepositAt[msg.sender] = block.timestamp;
        totalPool += amount;

        emit DepositMade(msg.sender, amount, block.timestamp);
    }

    /// @notice Claim payout when it's member's turn
    /// @return Payout amount
    function claimPayout() external onlyMember notPanicked nonReentrant returns (uint256) {
        MemberData storage member = members[msg.sender];
        MemberStanding storage standing = standings[msg.sender];

        if (!standing.isActive) revert Disqualified();
        if (member.hasReceivedPayout) revert AlreadyPaid();

        // Check rotation order if set
        if (rotationOrder.length > 0) {
            uint256 idx = circle.currentRound - 1;
            if (idx >= rotationOrder.length) revert InvalidInput();
            if (rotationOrder[idx] != msg.sender) revert Unauthorized();
        }

        uint256 payout = circle.memberCount * circle.contributionAmount;

        IERC20(circle.tokenAddress).safeTransfer(msg.sender, payout);

        member.hasReceivedPayout = true;
        member.totalWithdrawn += payout;

        emit PayoutClaimed(msg.sender, payout);

        return payout;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function _addMember(address _member) private {
        members[_member] = MemberData({
            memberAddress: _member,
            totalContributed: 0,
            totalWithdrawn: 0,
            hasReceivedPayout: false,
            status: MemberStatus.Active
        });

        standings[_member] = MemberStanding({
            missedCount: 0,
            isActive: true
        });

        memberAddresses.push(_member);
    }

    // Additional functions (governance, emergency, admin) would follow...
    // See full implementation in Rust contract for complete logic
}
```

## Type Mapping

| Rust (Soroban) | Solidity (Ethereum) |
|----------------|---------------------|
| `i128` | `uint256` |
| `u32` | `uint256` |
| `u64` | `uint256` |
| `Address` | `address` |
| `bool` | `bool` |
| `Map<K, V>` | `mapping(K => V)` |
| `Vec<T>` | `T[]` |
| `Result<T, E>` | `returns (T)` + `revert` |
| `Option<T>` | Check for zero/null |

## Function Migration Checklist

### Core Functions
- [ ] `initialize_circle` → Constructor
- [ ] `join_circle` → `joinCircle`
- [ ] `contribute` → `contribute`
- [ ] `deposit` → `deposit`
- [ ] `claim_payout` → `claimPayout`
- [ ] `shuffle_rotation` → `shuffleRotation`

### Governance
- [ ] `start_dissolution_vote` → `startDissolutionVote`
- [ ] `vote_to_dissolve` → `voteToDissolve`
- [ ] `dissolve_and_refund` → `dissolveAndRefund`

### Emergency
- [ ] `panic` → `panic`
- [ ] `emergency_refund` → `emergencyRefund`

### Admin
- [ ] `set_kyc_status` → `setKycStatus`
- [ ] `slash_member` → `slashMember`
- [ ] `boot_dormant_member` → `bootDormantMember`

### Queries
- [ ] `get_circle_state` → Public variables
- [ ] `get_member_balance` → `getMemberBalance`
- [ ] `get_members` → `getMembers`

## Key Differences to Handle

### 1. Authorization
**Rust (Soroban)**:
```rust
member.require_auth();
```

**Solidity**:
```solidity
modifier onlyMember() {
    require(members[msg.sender].memberAddress != address(0), "Not a member");
    _;
}
```

### 2. Error Handling
**Rust**:
```rust
return Err(AjoError::Unauthorized);
```

**Solidity**:
```solidity
revert Unauthorized();
```

### 3. Token Transfers
**Rust**:
```rust
token_client.transfer(&member, &env.current_contract_address(), &amount);
```

**Solidity**:
```solidity
IERC20(tokenAddress).safeTransferFrom(member, address(this), amount);
```

### 4. Storage
**Rust**:
```rust
env.storage().instance().set(&DataKey::Circle, &circle_data);
```

**Solidity**:
```solidity
circle = circleData; // Direct assignment
```

## Testing Migration

### Hardhat Test Template

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AjoCircle", function () {
  let ajoCircle;
  let token;
  let organizer, member1, member2;

  beforeEach(async function () {
    [organizer, member1, member2] = await ethers.getSigners();

    // Deploy mock token
    const Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy("Test USDC", "USDC", 6);

    // Deploy Ajo Circle
    const AjoCircle = await ethers.getContractFactory("AjoCircle");
    ajoCircle = await AjoCircle.deploy(
      await token.getAddress(),
      ethers.parseUnits("100", 6), // 100 USDC
      7, // 7 days
      12, // 12 rounds
      10 // 10 members
    );

    // Mint tokens
    await token.mint(organizer.address, ethers.parseUnits("10000", 6));
    await token.mint(member1.address, ethers.parseUnits("10000", 6));
  });

  it("Should initialize circle correctly", async function () {
    const circle = await ajoCircle.circle();
    expect(circle.organizer).to.equal(organizer.address);
    expect(circle.contributionAmount).to.equal(ethers.parseUnits("100", 6));
  });

  it("Should allow organizer to add members", async function () {
    await ajoCircle.joinCircle(member1.address);
    const member = await ajoCircle.members(member1.address);
    expect(member.memberAddress).to.equal(member1.address);
  });

  // Add more tests...
});
```

## Deployment Script

```javascript
// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  // Deploy token (or use existing)
  const tokenAddress = "0x..."; // USDC address

  // Deploy Ajo Circle
  const AjoCircle = await ethers.getContractFactory("AjoCircle");
  const ajoCircle = await AjoCircle.deploy(
    tokenAddress,
    ethers.parseUnits("100", 6), // 100 USDC
    7, // Weekly
    12, // 12 rounds
    10 // 10 members
  );

  await ajoCircle.waitForDeployment();

  console.log("AjoCircle deployed to:", await ajoCircle.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## Gas Optimization Tips

1. **Use `uint256` instead of smaller types** (unless packing)
2. **Cache storage variables** in memory
3. **Use `calldata` for read-only arrays**
4. **Batch operations** where possible
5. **Avoid loops** over unbounded arrays
6. **Use events** instead of storage for historical data

## Security Considerations

### Add These to Solidity Version
1. **ReentrancyGuard**: Prevent reentrancy attacks
2. **SafeERC20**: Safe token transfers
3. **Ownable**: Access control
4. **Pausable**: Emergency pause mechanism
5. **Input validation**: Check all parameters

### Audit Checklist
- [ ] Reentrancy protection
- [ ] Integer overflow/underflow (use Solidity 0.8+)
- [ ] Access control
- [ ] Front-running protection
- [ ] Gas optimization
- [ ] Event emission
- [ ] Error handling

## Estimated Migration Effort

| Task | Estimated Time |
|------|----------------|
| Contract translation | 2-3 days |
| Test migration | 1-2 days |
| Deployment scripts | 1 day |
| Integration testing | 2-3 days |
| Security audit | 1-2 weeks |
| **Total** | **2-3 weeks** |

## Conclusion

The current Stellar/Soroban implementation is production-ready and recommended for financial applications due to lower costs and better performance. However, if Ethereum compatibility is required, this guide provides a complete migration path.

## Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [Ethereum Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
