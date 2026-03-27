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
        for (uint32 i = 0; i < count; i++) {
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
        for (uint32 i = 0; i < count; i++) {
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
}
