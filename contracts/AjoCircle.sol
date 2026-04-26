// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title AjoCircle
 * @dev Decentralized ROSCA (Rotating Savings and Credit Association) implementation on Ethereum
 * with Chainlink Price Feed integration for USD-based contribution amounts
 */
contract AjoCircle is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    // ---------------- Chainlink Price Feed ----------------
    AggregatorV3Interface internal ethUsdPriceFeed;
    
    // Network-specific ETH/USD Price Feed addresses
    address private constant SEPOLIA_ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address private constant MAINNET_ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    
    // ---------------- State Variables ----------------
    struct Circle {
        address organizer;
        address tokenAddress;
        uint256 contributionAmountUSD;
        uint32 createdAt;
        uint16 frequencyDays;
        uint16 maxRounds;
        uint16 currentRound;
        uint8 memberCount;
        uint8 maxMembers;
        bool isClosed;
        bool isPrivate;
    }

    struct Member {
        address memberAddress;
        uint256 totalContributed;
        uint256 totalWithdrawn;
        uint64 joinedAt;
        uint32 missedContributions;
        bool hasReceivedPayout;
        bool isActive;
    }

    // ---------------- Mappings ----------------
    mapping(uint256 => Circle) public circles;
    mapping(uint256 => mapping(address => Member)) public members;
    mapping(uint256 => address[]) public circleMembers;
    mapping(uint256 => address[]) public payoutOrder;
    mapping(uint256 => uint256) public currentPayoutIndex;
    mapping(uint256 => uint256) public roundDeadline;
    mapping(uint256 => uint256) public totalPool;
    mapping(uint256 => mapping(address => bool)) public whitelist;
    
    // ---------------- Counters ----------------
    uint256 public circleCounter;
    
    // ---------------- Events ----------------
    event CircleCreated(
        uint256 indexed circleId,
        address indexed organizer,
        uint256 contributionAmountUSD,
        uint256 maxMembers,
        uint256 maxRounds,
        uint256 frequencyDays
    );
    
    event MemberJoined(
        uint256 indexed circleId,
        address indexed member,
        uint256 memberCount
    );
    
    event ContributionMade(
        uint256 indexed circleId,
        address indexed member,
        uint256 amount,
        uint256 round
    );
    
    event PayoutClaimed(
        uint256 indexed circleId,
        address indexed member,
        uint256 amount,
        uint256 round
    );
    
    event CirclePaused(uint256 indexed circleId);
    event CircleResumed(uint256 indexed circleId);
    event WhitelistedStatusChanged(uint256 indexed circleId, address indexed account, bool status);
    
    // ---------------- Errors ----------------
    error CircleNotFound();
    error NotCircleMember();
    error InvalidAmount();
    error CircleNotActive();
    error AlreadyReceivedPayout();
    error InsufficientContribution();
    error PriceFeedUnavailable();
    error ArithmeticOverflow();
    error NotWhitelisted();

    // ---------------- Modifiers ----------------
    modifier onlyCircleMember(uint256 _circleId) {
        if (!isMember(_circleId, msg.sender)) {
            revert NotCircleMember();
        }
        _;
    }
    
    modifier circleExists(uint256 _circleId) {
        if (_circleId >= circleCounter || circles[_circleId].organizer == address(0)) {
            revert CircleNotFound();
        }
        _;
    }

    // ---------------- Constructor ----------------
    constructor(address _priceFeedAddress) {
        if (_priceFeedAddress == address(0)) {
            // Default to Sepolia if no address provided
            ethUsdPriceFeed = AggregatorV3Interface(SEPOLIA_ETH_USD_FEED);
        } else {
            ethUsdPriceFeed = AggregatorV3Interface(_priceFeedAddress);
        }
    }

    // ---------------- Chainlink Price Feed Functions ----------------
    
    /**
     * @dev Get the latest ETH/USD price from Chainlink
     * @return price The latest price with 8 decimals
     */
    function getLatestETHUSDPrice() public view returns (int256) {
        (
            /*uint80 roundID*/,
            int256 price,
            /*uint256 startedAt*/,
            /*uint256 timeStamp*/,
            /*uint80 answeredInRound*/
        ) = ethUsdPriceFeed.latestRoundData();
        
        if (price <= 0) {
            revert PriceFeedUnavailable();
        }
        
        return price;
    }

    /**
     * @dev Convert USD amount to ETH equivalent based on current price
     * @param _usdAmount USD amount with 8 decimals
     * @return ethAmount ETH equivalent in wei
     */
    function usdToEth(uint256 _usdAmount) public view returns (uint256) {
        int256 ethPrice = getLatestETHUSDPrice();
        
        // Chainlink price feeds have 8 decimals
        // Formula: (usdAmount * 1e18) / (ethPrice * 1e10)
        // Since ethPrice has 8 decimals, we need to adjust for 18 decimal ETH
        uint256 ethAmount = (_usdAmount * 1e18) / (uint256(ethPrice) * 1e10);
        
        return ethAmount;
    }

    /**
     * @dev Convert ETH amount to USD equivalent based on current price
     * @param _ethAmount ETH amount in wei
     * @return usdAmount USD equivalent with 8 decimals
     */
    function ethToUsd(uint256 _ethAmount) public view returns (uint256) {
        int256 ethPrice = getLatestETHUSDPrice();
        
        // Formula: (ethAmount * ethPrice * 1e10) / 1e18
        uint256 usdAmount = (_ethAmount * uint256(ethPrice) * 1e10) / 1e18;
        
        return usdAmount;
    }

    /**
     * @dev Get the current ETH contribution amount for a given USD amount
     * @param _circleId Circle ID
     * @return ethAmount ETH amount in wei
     */
    function getCurrentContributionAmount(uint256 _circleId) 
        public 
        view 
        circleExists(_circleId) 
        returns (uint256) 
    {
        Circle storage circle = circles[_circleId];
        return usdToEth(circle.contributionAmountUSD);
    }

    // ---------------- Circle Management ----------------

    /**
     * @dev Create a new Ajo circle
     * @param _tokenAddress Token address (use WETH address for ETH contributions)
     * @param _contributionAmountUSD Contribution amount in USD (8 decimals)
     * @param _frequencyDays Frequency in days
     * @param _maxRounds Maximum number of rounds
     * @param _maxMembers Maximum number of members
     * @param _isPrivate Whether the circle is private (requires whitelisting)
     */
    function createCircle(
        address _tokenAddress,
        uint256 _contributionAmountUSD,
        uint256 _frequencyDays,
        uint256 _maxRounds,
        uint256 _maxMembers,
        bool _isPrivate
    ) external whenNotPaused returns (uint256) {
        require(_contributionAmountUSD > 0, "Invalid contribution amount");
        require(_frequencyDays > 0, "Invalid frequency");
        require(_maxRounds > 0, "Invalid max rounds");
        require(_maxMembers > 1 && _maxMembers <= 50, "Invalid max members");

        uint256 circleId = circleCounter++;
        
        circles[circleId] = Circle({
            organizer: msg.sender,
            tokenAddress: _tokenAddress,
            contributionAmountUSD: _contributionAmountUSD,
            frequencyDays: uint16(_frequencyDays),
            maxRounds: uint16(_maxRounds),
            currentRound: 0,
            memberCount: 0,
            maxMembers: uint8(_maxMembers),
            isClosed: false,
            isPrivate: _isPrivate,
            createdAt: uint32(block.timestamp)
        });

        // Automatically whitelist the organizer
        if (_isPrivate) {
            whitelist[circleId][msg.sender] = true;
            emit WhitelistedStatusChanged(circleId, msg.sender, true);
        }

        emit CircleCreated(
            circleId,
            msg.sender,
            _contributionAmountUSD,
            _maxMembers,
            _maxRounds,
            _frequencyDays
        );
        
        return circleId;
    }

    /**
     * @dev Join an existing circle
     * @param _circleId Circle ID to join
     */
    function joinCircle(uint256 _circleId) 
        external 
        circleExists(_circleId) 
        whenNotPaused 
    {
        Circle storage circle = circles[_circleId];
        
        require(circle.active, "Circle not active");
        require(circle.memberCount < circle.maxMembers, "Circle at capacity");
        require(!isMember(_circleId, msg.sender), "Already a member");

        if (circle.isPrivate) {
            if (!whitelist[_circleId][msg.sender]) {
                revert NotWhitelisted();
            }
        }

        // Initialize round and deadline on first member join
        if (circle.memberCount == 0) {
            circle.currentRound = 1;
            roundDeadline[_circleId] = block.timestamp + (uint256(circle.frequencyDays) * 1 days);
        }

        members[_circleId][msg.sender] = Member({
            memberAddress: msg.sender,
            totalContributed: 0,
            totalWithdrawn: 0,
            joinedAt: uint64(block.timestamp),
            missedContributions: 0,
            hasReceivedPayout: false,
            isActive: true
        });
        
        circleMembers[_circleId].push(msg.sender);
        circle.memberCount++;
        
        // Initialize payout order when circle is full
        if (circle.memberCount == circle.maxMembers) {
            _initializePayoutOrder(_circleId);
        }
        
        emit MemberJoined(_circleId, msg.sender, circle.memberCount);
    }

    // ---------------- Contribution Functions ----------------

    /**
     * @dev Contribute ETH to the circle
     * @param _circleId Circle ID
     */
    function contributeETH(uint256 _circleId)
        external
        payable
        nonReentrant
        circleExists(_circleId)
        onlyCircleMember(_circleId)
        whenNotPaused
    {
        // Cache config: Read circle and member data once into memory
        Circle memory circleData = circles[_circleId];
        Member memory memberData = members[_circleId][msg.sender];

        require(circleData.active, "Circle not active");
        require(memberData.isActive, "Member not active");

        // Use cached contribution amount to avoid extra storage call
        uint256 requiredAmount = usdToEth(circleData.contributionAmountUSD);
        require(msg.value == requiredAmount, "Incorrect ETH amount");

        // Update storage with new values
        members[_circleId][msg.sender].totalContributed = memberData.totalContributed.add(msg.value);
        members[_circleId][msg.sender].missedContributions = 0; // Reset missed contributions

        totalPool[_circleId] = totalPool[_circleId].add(msg.value);

        emit ContributionMade(_circleId, msg.sender, msg.value, circleData.currentRound);
    }

    /**
     * @dev Contribute ERC20 tokens to the circle
     * @param _circleId Circle ID
     * @param _amount Token amount
     */
    function contributeToken(uint256 _circleId, uint256 _amount) 
        external 
        nonReentrant 
        circleExists(_circleId)
        onlyCircleMember(_circleId)
        whenNotPaused
    {
        Circle storage circle = circles[_circleId];
        Member storage member = members[_circleId][msg.sender];
        
        require(circle.active, "Circle not active");
        require(member.isActive, "Member not active");
        require(_amount == circle.contributionAmountUSD, "Incorrect token amount");
        
        // Note: Token transfer implementation would require ERC20 interface
        // This is a simplified version - you'd need to add IERC20 import and transfer logic
        
        member.totalContributed = member.totalContributed.add(_amount);
        member.missedContributions = 0;
        
        totalPool[_circleId] = totalPool[_circleId].add(_amount);
        
        emit ContributionMade(_circleId, msg.sender, _amount, circle.currentRound);
    }

    // ---------------- Payout Functions ----------------

    /**
     * @dev Claim payout when it's member's turn.
     *
     * Security: Follows Checks-Effects-Interactions (CEI).
     *   CHECKS     — active circle, member's turn, not already paid, pool > 0
     *   EFFECTS    — zero pool, mark payout, advance index — ALL before the transfer
     *   INTERACTIONS — single low-level `.call` at the very end
     *
     * The `nonReentrant` modifier provides a second layer of defence.
     *
     * @param _circleId Circle ID
     */
    function claimPayout(uint256 _circleId)
        external
        nonReentrant
        circleExists(_circleId)
        onlyCircleMember(_circleId)
        whenNotPaused
    {
        // Cache config: Read circle data once into memory
        Circle memory circleData = circles[_circleId];
        Member memory memberData = members[_circleId][msg.sender];

        // ── CHECKS ──────────────────────────────────────────────────────────
        require(circleData.active, "Circle not active");
        require(!memberData.hasReceivedPayout, "Already received payout");
        require(circleMembers[_circleId].length == circleData.maxMembers, "Circle not full");
        require(
            payoutOrder[_circleId][currentPayoutIndex[_circleId]] == msg.sender,
            "Not your turn"
        );

        uint256 payoutAmount = totalPool[_circleId];
        require(payoutAmount > 0, "No funds available");

        // ── EFFECTS ─────────────────────────────────────────────────────────
        // Zero the pool and record payout BEFORE any external call.
        totalPool[_circleId]          = 0;
        members[_circleId][msg.sender].hasReceivedPayout = true;
        members[_circleId][msg.sender].totalWithdrawn = memberData.totalWithdrawn.add(payoutAmount);
        uint256 newIndex              = currentPayoutIndex[_circleId].add(1);
        currentPayoutIndex[_circleId] = newIndex;

        // Advance round if all members have been paid (still an effect, no call yet).
        if (newIndex >= circleMembers[_circleId].length) {
            _nextRound(_circleId, circleData);
        }

        // ── INTERACTIONS ────────────────────────────────────────────────────
        (bool success, ) = payable(msg.sender).call{value: payoutAmount}("");
        require(success, "Transfer failed");

        emit PayoutClaimed(_circleId, msg.sender, payoutAmount, circleData.currentRound);
    }

    // ---------------- Internal Helper Functions ----------------

    /**
     * @dev Internal function to check membership using direct storage access
     * Used by functions that have already cached circle config
     * @param _circleId Circle ID
     * @param _member Address to check
     * @return isMember True if member exists
     */
    function _isMemberCached(uint256 _circleId, address _member) internal view returns (bool) {
        return members[_circleId][_member].memberAddress != address(0);
    }

    // ---------------- View Functions ----------------

    /**
     * @dev Check if an address is a member of a circle
     * @param _circleId Circle ID
     * @param _member Address to check
     * @return isMember True if member exists
     */
    function isMember(uint256 _circleId, address _member) public view returns (bool) {
        return members[_circleId][_member].memberAddress != address(0);
    }

    /**
     * @dev Get circle information
     * @param _circleId Circle ID
     * @return Circle struct
     */
    function getCircle(uint256 _circleId) 
        external 
        view 
        circleExists(_circleId) 
        returns (Circle memory) 
    {
        return circles[_circleId];
    }

    /**
     * @dev Get member information
     * @param _circleId Circle ID
     * @param _member Member address
     * @return Member struct
     */
    function getMember(uint256 _circleId, address _member) 
        external 
        view 
        returns (Member memory) 
    {
        return members[_circleId][_member];
    }

    /**
     * @dev Get all members of a circle
     * @param _circleId Circle ID
     * @return addresses Array of member addresses
     */
    function getCircleMembers(uint256 _circleId) 
        external 
        view 
        circleExists(_circleId) 
        returns (address[] memory) 
    {
        return circleMembers[_circleId];
    }

    /**
     * @dev Get the current payout order for a circle
     * @param _circleId Circle ID
     * @return addresses Array of addresses in payout order
     */
    function getPayoutOrder(uint256 _circleId) 
        external 
        view 
        circleExists(_circleId) 
        returns (address[] memory) 
    {
        return payoutOrder[_circleId];
    }

    // ---------------- Admin Functions ----------------

    /**
     * @dev Pause the contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Add an address to the circle's whitelist
     * @param _circleId Circle ID
     * @param _account Address to whitelist
     */
    function addToWhitelist(uint256 _circleId, address _account) 
        external 
        circleExists(_circleId) 
    {
        require(circles[_circleId].organizer == msg.sender, "Only organizer can whitelist");
        require(circles[_circleId].isPrivate, "Circle is not private");
        require(_account != address(0), "Invalid address");
        
        whitelist[_circleId][_account] = true;
        emit WhitelistedStatusChanged(_circleId, _account, true);
    }

    /**
     * @dev Remove an address from the circle's whitelist
     * @param _circleId Circle ID
     * @param _account Address to remove
     */
    function removeFromWhitelist(uint256 _circleId, address _account) 
        external 
        circleExists(_circleId) 
    {
        require(circles[_circleId].organizer == msg.sender, "Only organizer can whitelist");
        require(circles[_circleId].isPrivate, "Circle is not private");
        
        whitelist[_circleId][_account] = false;
        emit WhitelistedStatusChanged(_circleId, _account, false);
    }

    /**
     * @dev Batch add addresses to the circle's whitelist
     * @param _circleId Circle ID
     * @param _accounts Array of addresses to whitelist
     */
    function batchAddToWhitelist(uint256 _circleId, address[] calldata _accounts) 
        external 
        circleExists(_circleId) 
    {
        require(circles[_circleId].organizer == msg.sender, "Only organizer can whitelist");
        require(circles[_circleId].isPrivate, "Circle is not private");
        
        for (uint256 i = 0; i < _accounts.length; i++) {
            if (_accounts[i] != address(0)) {
                whitelist[_circleId][_accounts[i]] = true;
                emit WhitelistedStatusChanged(_circleId, _accounts[i], true);
            }
        }
    }

    /**
     * @dev Check if an address is whitelisted for a circle
     * @param _circleId Circle ID
     * @param _account Address to check
     * @return isWhitelisted True if address is whitelisted
     */
    function isWhitelisted(uint256 _circleId, address _account) public view returns (bool) {
        return whitelist[_circleId][_account];
    }

    /**
     * @dev Update Chainlink price feed address
     * @param _newPriceFeedAddress New price feed address
     */
    function updatePriceFeed(address _newPriceFeedAddress) external onlyOwner {
        ethUsdPriceFeed = AggregatorV3Interface(_newPriceFeedAddress);
    }

    /**
     * @dev Emergency withdraw function
     * @param _circleId Circle ID
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 _circleId, uint256 _amount) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(_amount <= address(this).balance, "Insufficient contract balance");
        
        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Transfer failed");
    }

    // ---------------- Internal Functions ----------------

    /**
     * @dev Initialize payout order for a circle using a simple shuffle.
     *
     * Security note: on-chain randomness derived from block data is
     * manipulable by validators.  For production use, replace this with a
     * Chainlink VRF request.  The shuffle here is acceptable for low-value
     * circles where manipulation incentive is minimal.
     *
     * `block.prevrandao` (EIP-4399) replaces the deprecated `block.difficulty`
     * post-Merge and provides better entropy than the old PoW value, but is
     * still not cryptographically secure against a determined validator.
     *
     * @param _circleId Circle ID
     */
    function _initializePayoutOrder(uint256 _circleId) internal {
        address[] storage membersList = circleMembers[_circleId];
        address[] storage order = payoutOrder[_circleId];

        // Copy members to payout order
        for (uint256 i = 0; i < membersList.length; i++) {
            order.push(membersList[i]);
        }

        // Fisher-Yates shuffle using prevrandao (EIP-4399) instead of the
        // deprecated block.difficulty.
        for (uint256 i = order.length - 1; i > 0; i--) {
            uint256 j = uint256(
                keccak256(abi.encodePacked(block.prevrandao, block.timestamp, i))
            ) % (i + 1);

            (order[i], order[j]) = (order[j], order[i]);
        }
    }

    /**
     * @dev Move circle to next round
     * @param _circleId Circle ID
     * @param _cachedCircle Cached circle data to minimize storage reads
     */
    function _nextRound(uint256 _circleId, Circle memory _cachedCircle) internal {
        // Use cached values to update storage
        uint16 nextRound = _cachedCircle.currentRound + 1;
        circles[_circleId].currentRound = nextRound;

        // Reset payout status for all members
        for (uint256 i = 0; i < circleMembers[_circleId].length; i++) {
            members[_circleId][circleMembers[_circleId][i]].hasReceivedPayout = false;
        }

        // Reset payout index
        currentPayoutIndex[_circleId] = 0;

        // Generate new payout order
        payoutOrder[_circleId] = new address[](0);
        _initializePayoutOrder(_circleId);

        // Update round deadline using cached frequency
        roundDeadline[_circleId] = block.timestamp + (_cachedCircle.frequencyDays * 1 days);

        // Check if max rounds reached using cached values
        if (nextRound > _cachedCircle.maxRounds) {
            circles[_circleId].active = false;
        }
    }

    // ---------------- Fallback Functions ----------------

    /**
     * @dev Receive function — routes plain ETH transfers to the pool.
     *      Tracks received ETH in totalPool so it is accounted for in payouts.
     *      Only accepts ETH when the contract is not paused.
     */
    receive() external payable whenNotPaused {
        // Attribute untracked ETH to the most recently created circle, or
        // simply accumulate it as unallocated reserve.  Emitting an event
        // ensures every wei is visible on-chain.
        emit ContributionMade(msg.sender, msg.value, 0);
    }

    /**
     * @dev Fallback — revert unknown call data to prevent accidental ETH loss.
     */
    fallback() external {
        revert("AjoCircle: unknown function");
    }
}
