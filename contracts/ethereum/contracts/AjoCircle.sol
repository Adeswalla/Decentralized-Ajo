// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title Ajo Circle
/// @notice Decentralized Rotating Savings and Credit Association (ROSCA)
/// @dev Implements a trustless group savings mechanism with rotating payouts
contract AjoCircle is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

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
    struct CircleData {
        address organizer;
        address tokenAddress;
        uint256 contributionAmount;
        uint32 frequencyDays;
        uint32 maxRounds;
        uint32 currentRound;
        uint32 memberCount;
        uint32 maxMembers;
    }

    /// @notice Individual member data
    struct MemberData {
        address memberAddress;
        uint256 totalContributed;
        uint256 totalWithdrawn;
        bool hasReceivedPayout;
        MemberStatus status;
    }

    /// @notice Member activity tracking
    struct MemberStanding {
        uint256 missedCount;
        bool isActive;
    }

    /// @notice Dissolution vote tracking
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

    mapping(uint256 => address) public memberAddresses;
    uint256 public memberAddressesCount;
    mapping(uint256 => address) public rotationOrder;
    uint256 public rotationOrderCount;

    uint256 public roundDeadline;
    uint256 public roundContribCount;
    uint256 public totalPool;
    bool public circleFinished;

    // ═══════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Get a slice of member addresses
    function getMemberAddressesSlice(uint256 _offset, uint256 _limit) external view returns (address[] memory) {
        uint256 count = _limit;
        if (_offset + _limit > memberAddressesCount) {
            count = memberAddressesCount > _offset ? memberAddressesCount - _offset : 0;
        }

        address[] memory slice = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            slice[i] = memberAddresses[_offset + i];
        }
        return slice;
    }

    /// @notice Get a slice of rotation order addresses
    function getRotationOrderSlice(uint256 _offset, uint256 _limit) external view returns (address[] memory) {
        uint256 count = _limit;
        if (_offset + _limit > rotationOrderCount) {
            count = rotationOrderCount > _offset ? rotationOrderCount - _offset : 0;
        }

        address[] memory slice = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            slice[i] = rotationOrder[_offset + i];
        }
        return slice;
    }

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
    event WithdrawCompleted(address indexed receiver, uint256 amount, uint256 cycle);
    event CircleCompleted(uint256 totalCycles);
    event CircleDissolved();
    event PanicTriggered(address indexed admin);

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error NotFound();
    error Unauthorized();
    error AlreadyExists();
    error InvalidInput();
    error AlreadyPaid();
    error Disqualified();
    error CircleNotActive();
    error CircleAtCapacity();
    error CirclePanicked();
    error PoolThresholdNotMet();
    error TransferFailed();

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

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZER (REPLACES CONSTRUCTOR)
    // ═══════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize a new Ajo circle
    /// @param _organizer Circle creator and administrator
    /// @param _tokenAddress Token contract address
    /// @param _contributionAmount Required contribution per round
    /// @param _frequencyDays Round duration in days
    /// @param _maxRounds Total number of rounds
    /// @param _maxMembers Maximum member capacity (0 = default)
    function initialize(
        address _organizer,
        address _tokenAddress,
        uint256 _contributionAmount,
        uint256 _frequencyDays,
        uint256 _maxRounds,
        uint256 _maxMembers
    ) external initializer {
        __Ownable_init(_organizer);
        __ReentrancyGuard_init();

        if (_contributionAmount == 0) revert InvalidInput();
        if (_frequencyDays == 0) revert InvalidInput();
        if (_maxRounds == 0) revert InvalidInput();

        uint256 configuredMaxMembers = _maxMembers == 0 ? MAX_MEMBERS : _maxMembers;
        if (configuredMaxMembers > HARD_CAP) revert InvalidInput();

        circle = CircleData({
            organizer: _organizer,
            tokenAddress: _tokenAddress,
            contributionAmount: _contributionAmount,
            frequencyDays: uint32(_frequencyDays),
            maxRounds: uint32(_maxRounds),
            currentRound: 1,
            memberCount: 1,
            maxMembers: uint32(configuredMaxMembers)
        });

        circleStatus = CircleStatus.Active;
        roundDeadline = block.timestamp + (_frequencyDays * 1 days);

        // Add organizer as first member
        _addMember(_organizer);

        emit CircleInitialized(
            _organizer,
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

    function joinCircle(address _newMember) external onlyOrganizer notPanicked {
        if (members[_newMember].memberAddress != address(0)) revert AlreadyExists();
        CircleData memory _circle = circle;
        if (_circle.memberCount >= _circle.maxMembers) revert CircleAtCapacity();

        _addMember(_newMember);
        circle.memberCount = _circle.memberCount + 1;

        emit MemberJoined(_newMember, _circle.memberCount + 1);
    }

    function contribute(uint256 _amount) external onlyMember notPanicked nonReentrant {
        if (_amount == 0) revert InvalidInput();

        MemberStanding storage standing = standings[msg.sender];
        if (standing.missedCount >= 3) revert Disqualified();
        if (!standing.isActive) revert Disqualified();

        standing.missedCount = 0;

        CircleData memory _circle = circle;
        IERC20Upgradeable(_circle.tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        MemberData storage member = members[msg.sender];
        uint256 roundTarget = uint256(_circle.currentRound) * _circle.contributionAmount;
        bool hadCompletedRound = member.totalContributed >= roundTarget;

        member.totalContributed += _amount;

        bool hasCompletedRound = member.totalContributed >= roundTarget;

        if (!hadCompletedRound && hasCompletedRound) {
            uint256 _roundContribCount = roundContribCount + 1;

            if (_roundContribCount >= uint256(_circle.memberCount)) {
                roundDeadline += uint256(_circle.frequencyDays) * 1 days;
                if (_circle.currentRound < _circle.maxRounds) {
                    circle.currentRound = _circle.currentRound + 1;
                }
                roundContribCount = 0;
            } else {
                roundContribCount = _roundContribCount;
            }
        }

        emit ContributionMade(msg.sender, _amount);
    }

    /// @notice Batch contribute on behalf of multiple members
    /// @dev Processes multiple contributions in a single transaction to save gas
    /// @param _members Array of member addresses to contribute for
    /// @param _amounts Array of contribution amounts (must match _members length)
    function batchContribute(address[] calldata _members, uint256[] calldata _amounts) 
        external 
        onlyOrganizer 
        notPanicked 
        nonReentrant 
    {
        if (_members.length == 0) revert InvalidInput();
        if (_members.length != _amounts.length) revert InvalidInput();
        if (_members.length > 50) revert InvalidInput(); // Limit batch size to prevent gas issues

        CircleData memory _circle = circle;
        uint256 totalAmount = 0;
        uint256 newCompletions = 0;

        // First pass: validate all inputs and calculate total
        for (uint256 i = 0; i < _members.length; i++) {
            address memberAddr = _members[i];
            uint256 amount = _amounts[i];

            if (amount == 0) revert InvalidInput();
            if (members[memberAddr].memberAddress == address(0)) revert NotFound();

            MemberStanding storage standing = standings[memberAddr];
            if (standing.missedCount >= 3) revert Disqualified();
            if (!standing.isActive) revert Disqualified();

            totalAmount += amount;
        }

        // Single token transfer for all contributions
        IERC20Upgradeable(_circle.tokenAddress).safeTransferFrom(
            msg.sender, 
            address(this), 
            totalAmount
        );

        // Second pass: update member states
        for (uint256 i = 0; i < _members.length; i++) {
            address memberAddr = _members[i];
            uint256 amount = _amounts[i];

            MemberStanding storage standing = standings[memberAddr];
            standing.missedCount = 0;

            MemberData storage member = members[memberAddr];
            uint256 roundTarget = uint256(_circle.currentRound) * _circle.contributionAmount;
            bool hadCompletedRound = member.totalContributed >= roundTarget;

            member.totalContributed += amount;

            bool hasCompletedRound = member.totalContributed >= roundTarget;

            if (!hadCompletedRound && hasCompletedRound) {
                newCompletions++;
            }

            emit ContributionMade(memberAddr, amount);
        }

        // Update round progress once at the end
        if (newCompletions > 0) {
            uint256 _roundContribCount = roundContribCount + newCompletions;

            if (_roundContribCount >= uint256(_circle.memberCount)) {
                roundDeadline += uint256(_circle.frequencyDays) * 1 days;
                if (_circle.currentRound < _circle.maxRounds) {
                    circle.currentRound = _circle.currentRound + 1;
                }
                roundContribCount = 0;
            } else {
                roundContribCount = _roundContribCount;
            }
        }
    }

    function deposit() external onlyMember notPanicked nonReentrant {
        MemberStanding storage standing = standings[msg.sender];
        if (standing.missedCount >= 3) revert Disqualified();
        if (!standing.isActive) revert Disqualified();

        standing.missedCount = 0;

        CircleData memory _circle = circle;
        uint256 amount = _circle.contributionAmount;
        IERC20Upgradeable(_circle.tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        MemberData storage member = members[msg.sender];
        member.totalContributed += amount;

        lastDepositAt[msg.sender] = block.timestamp;
        totalPool += amount;

        emit DepositMade(msg.sender, amount, block.timestamp);
    }

    function claimPayout() external onlyMember notPanicked nonReentrant returns (uint256) {
        MemberData storage member = members[msg.sender];
        MemberStanding storage standing = standings[msg.sender];

        if (!standing.isActive) revert Disqualified();
        if (member.hasReceivedPayout) revert AlreadyPaid();

        CircleData memory _circle = circle;

        if (rotationOrderCount > 0) {
            uint256 idx = uint256(_circle.currentRound) - 1;
            if (idx >= rotationOrderCount) revert InvalidInput();
            if (rotationOrder[idx] != msg.sender) revert Unauthorized();
        }

        uint256 payout = uint256(_circle.memberCount) * _circle.contributionAmount;

        IERC20Upgradeable(_circle.tokenAddress).safeTransfer(msg.sender, payout);

        member.hasReceivedPayout = true;
        member.totalWithdrawn += payout;

        emit PayoutClaimed(msg.sender, payout);

        return payout;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WITHDRAW (CYCLE-BASED NATIVE ETH PAYOUT)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Withdraw the pooled ETH for the current cycle.
    /// @dev Implements Checks-Effects-Interactions to prevent reentrancy.
    ///      The cycle receiver is determined by `members[currentCycle - 1]`
    ///      (1-indexed cycle maps to 0-indexed memberAddresses array).
    ///      Uses a low-level `.call` for the ETH transfer.
    function withdraw() external onlyMember notPanicked nonReentrant {
        // ── CHECKS ──────────────────────────────────────────────────────────

        require(!circleFinished, "Ajo: Circle already finished");

        CircleData memory _circle = circle;
        uint256 _currentCycle = uint256(_circle.currentRound);

        // Map cycle (1-indexed) to the 0-indexed memberAddresses array.
        require(_currentCycle >= 1 && _currentCycle <= memberAddressesCount,
            "Ajo: Invalid cycle index");

        address expectedReceiver = memberAddresses[_currentCycle - 1];
        require(msg.sender == expectedReceiver, "Ajo: Not your cycle turn");

        MemberData storage member = members[msg.sender];
        require(!member.hasReceivedPayout, "Ajo: Payout already claimed this rotation");

        MemberStanding storage standing = standings[msg.sender];
        require(standing.isActive, "Ajo: Member is not active");

        // Pool must equal contributionAmount * memberCount before payout.
        uint256 threshold = _circle.contributionAmount * uint256(_circle.memberCount);
        require(totalPool >= threshold, "Ajo: Pool threshold not met");

        uint256 amount = totalPool;

        // ── EFFECTS ─────────────────────────────────────────────────────────

        // Zero the pool and mark payout before the external call.
        totalPool = 0;
        member.hasReceivedPayout = true;
        member.totalWithdrawn += amount;

        // Advance the cycle.
        uint256 nextCycle = _currentCycle + 1;

        if (nextCycle > memberAddressesCount) {
            // All members have received a payout — circle is complete.
            circleFinished = true;
            emit CircleCompleted(_currentCycle);
        } else {
            circle.currentRound = uint32(nextCycle);
            // Reset payout flags so members can receive again in the next rotation.
            for (uint256 i = 0; i < memberAddressesCount; i++) {
                members[memberAddresses[i]].hasReceivedPayout = false;
            }
            // Re-mark the current receiver as paid so they can't double-claim.
            member.hasReceivedPayout = true;
        }

        // ── INTERACTIONS ────────────────────────────────────────────────────

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Ajo: ETH transfer failed");

        emit WithdrawCompleted(msg.sender, amount, _currentCycle);
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

        memberAddresses[memberAddressesCount] = _member;
        memberAddressesCount++;
    }

    /// @notice Accept native ETH contributions into the pool.
    /// @dev    Only members may send ETH directly; arbitrary senders are
    ///         rejected to prevent pool inflation attacks where a non-member
    ///         inflates `totalPool` past the threshold, triggering premature
    ///         payouts or locking legitimate withdrawals.
    receive() external payable {
        if (members[msg.sender].memberAddress == address(0)) revert NotFound();
        totalPool += msg.value;
    }
}
