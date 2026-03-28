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
        address tokenAddress; // Can be WETH for native ETH contributions
        uint256 contributionAmountUSD; // Contribution amount in USD (8 decimals for Chainlink compatibility)
        uint256 frequencyDays;
        uint256 maxRounds;
        uint256 currentRound;
        uint256 memberCount;
        uint256 maxMembers;
        bool active;
        uint256 createdAt;
    }

    struct Member {
        address memberAddress;
        uint256 totalContributed;
        uint256 totalWithdrawn;
        bool hasReceivedPayout;
        bool isActive;
        uint256 missedContributions;
        uint256 joinedAt;
    }

    // ---------------- Mappings ----------------
    mapping(uint256 => Circle) public circles;
    mapping(uint256 => mapping(address => Member)) public members;
    mapping(uint256 => address[]) public circleMembers;
    mapping(uint256 => address[]) public payoutOrder;
    mapping(uint256 => uint256) public currentPayoutIndex;
    mapping(uint256 => uint256) public roundDeadline;
    mapping(uint256 => uint256) public totalPool;
    
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
    
    // ---------------- Errors ----------------
    error CircleNotFound();
    error NotCircleMember();
    error InvalidAmount();
    error CircleNotActive();
    error AlreadyReceivedPayout();
    error InsufficientContribution();
    error PriceFeedUnavailable();
    error ArithmeticOverflow();

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
     */
    function createCircle(
        address _tokenAddress,
        uint256 _contributionAmountUSD,
        uint256 _frequencyDays,
        uint256 _maxRounds,
        uint256 _maxMembers
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
            frequencyDays: _frequencyDays,
            maxRounds: _maxRounds,
            currentRound: 1,
            memberCount: 1,
            maxMembers: _maxMembers,
            active: true,
            createdAt: block.timestamp
        });

        // Add organizer as first member
        members[circleId][msg.sender] = Member({
            memberAddress: msg.sender,
            totalContributed: 0,
            totalWithdrawn: 0,
            hasReceivedPayout: false,
            isActive: true,
            missedContributions: 0,
            joinedAt: block.timestamp
        });
        
        circleMembers[circleId].push(msg.sender);
        
        // Set initial round deadline
        roundDeadline[circleId] = block.timestamp + (_frequencyDays * 1 days);
        
        emit CircleCreated(
            circleId,
            msg.sender,
            _contributionAmountUSD,
            _maxMembers,
            _maxRounds,
            _frequencyDays
        );
        
        emit MemberJoined(circleId, msg.sender, 1);
        
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

        members[_circleId][msg.sender] = Member({
            memberAddress: msg.sender,
            totalContributed: 0,
            totalWithdrawn: 0,
            hasReceivedPayout: false,
            isActive: true,
            missedContributions: 0,
            joinedAt: block.timestamp
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
        Circle storage circle = circles[_circleId];
        Member storage member = members[_circleId][msg.sender];
        
        require(circle.active, "Circle not active");
        require(member.isActive, "Member not active");
        
        uint256 requiredAmount = getCurrentContributionAmount(_circleId);
        require(msg.value == requiredAmount, "Incorrect ETH amount");
        
        member.totalContributed = member.totalContributed.add(msg.value);
        member.missedContributions = 0; // Reset missed contributions
        
        totalPool[_circleId] = totalPool[_circleId].add(msg.value);
        
        emit ContributionMade(_circleId, msg.sender, msg.value, circle.currentRound);
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
     * @dev Claim payout when it's member's turn
     * @param _circleId Circle ID
     */
    function claimPayout(uint256 _circleId) 
        external 
        nonReentrant 
        circleExists(_circleId)
        onlyCircleMember(_circleId)
        whenNotPaused
    {
        Circle storage circle = circles[_circleId];
        Member storage member = members[_circleId][msg.sender];
        
        require(circle.active, "Circle not active");
        require(!member.hasReceivedPayout, "Already received payout");
        require(circleMembers[_circleId].length == circle.maxMembers, "Circle not full");
        
        // Check if it's this member's turn
        require(payoutOrder[_circleId][currentPayoutIndex[_circleId]] == msg.sender, "Not your turn");
        
        uint256 payoutAmount = totalPool[_circleId];
        require(payoutAmount > 0, "No funds available");
        
        member.hasReceivedPayout = true;
        member.totalWithdrawn = member.totalWithdrawn.add(payoutAmount);
        
        // Transfer payout
        (bool success, ) = payable(msg.sender).call{value: payoutAmount}("");
        require(success, "Transfer failed");
        
        totalPool[_circleId] = 0;
        currentPayoutIndex[_circleId]++;
        
        emit PayoutClaimed(_circleId, msg.sender, payoutAmount, circle.currentRound);
        
        // Move to next round if all members have received payouts
        if (currentPayoutIndex[_circleId] >= circleMembers[_circleId].length) {
            _nextRound(_circleId);
        }
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
     * @dev Initialize random payout order for a circle
     * @param _circleId Circle ID
     */
    function _initializePayoutOrder(uint256 _circleId) internal {
        address[] storage membersList = circleMembers[_circleId];
        address[] storage order = payoutOrder[_circleId];
        
        // Copy members to payout order
        for (uint256 i = 0; i < membersList.length; i++) {
            order.push(membersList[i]);
        }
        
        // Simple shuffle using blockhash and timestamp
        for (uint256 i = order.length - 1; i > 0; i--) {
            uint256 j = uint256(
                keccak256(abi.encodePacked(block.timestamp, block.difficulty, i))
            ) % (i + 1);
            
            (order[i], order[j]) = (order[j], order[i]);
        }
    }

    /**
     * @dev Move circle to next round
     * @param _circleId Circle ID
     */
    function _nextRound(uint256 _circleId) internal {
        Circle storage circle = circles[_circleId];
        
        circle.currentRound++;
        
        // Reset payout status for all members
        for (uint256 i = 0; i < circleMembers[_circleId].length; i++) {
            members[_circleId][circleMembers[_circleId][i]].hasReceivedPayout = false;
        }
        
        // Reset payout index
        currentPayoutIndex[_circleId] = 0;
        
        // Generate new payout order
        payoutOrder[_circleId] = new address[](0);
        _initializePayoutOrder(_circleId);
        
        // Update round deadline
        roundDeadline[_circleId] = block.timestamp + (circle.frequencyDays * 1 days);
        
        // Check if max rounds reached
        if (circle.currentRound > circle.maxRounds) {
            circle.active = false;
        }
    }

    // ---------------- Fallback Functions ----------------

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}

    /**
     * @dev Fallback function to accept ETH
     */
    fallback() external payable {}
}
