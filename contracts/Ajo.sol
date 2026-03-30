// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title Ajo
 * @dev A simple rotating savings and credit association (ROSCA) contract.
 * Includes a pause mechanism for emergency situations.
 */
contract Ajo is Initializable, Pausable, AccessControl {
    AggregatorV3Interface internal ethUsdPriceFeed;
    
    address private constant SEPOLIA_ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address private constant MAINNET_ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    
    uint256 public contributionAmountUSD;
    uint256 public contributionAmountEth;
    uint256 public cycleDuration;
    uint32 public currentCycle;
    uint256 public maxMembers;
    uint256 public totalPool;

    /// @notice List of all members in the Ajo pool
    address[] public members;

    /// @notice Mapping from member address to their current balance in the pool
    mapping(address => uint256) public balances;

    /// @notice Event emitted when a deposit is made
    event Deposited(address indexed member, uint256 amount);

    /**
     * @dev Struct to represent a member's state within the pool
     * @param addr The wallet address of the member
     * @param hasContributed Whether the member has contributed in the current cycle
     * @param totalContributed The total amount this member has ever contributed
     */
    struct MemberInfo {
        address addr;
        bool hasContributed;
        uint256 totalContributed;
    }

    error InvalidContribution();
    error AjoIsFull();

    error InvalidPrice();
    error PriceFeedUnavailable();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function getLatestPrice() public view returns (int256) {
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

    function usdToEth(uint256 _usdAmount) public view returns (uint256) {
        int256 ethPrice = getLatestPrice();
        uint256 ethAmount = (_usdAmount * 1e18) / (uint256(ethPrice) * 1e10);
        return ethAmount;
    }

    function ethToUsd(uint256 _ethAmount) public view returns (uint256) {
        int256 ethPrice = getLatestPrice();
        uint256 usdAmount = (_ethAmount * uint256(ethPrice) * 1e10) / 1e18;
        return usdAmount;
    }

    /**
     * @dev Initializes the Ajo pool with core parameters
     * @param _amountUSD The amount required for each contribution in USD (8 decimals)
     * @param _cycleDuration Duration of each cycle in seconds
     * @param _maxMembers The maximum capacity of the pool
     * @param _priceFeedAddress Chainlink price feed address (use address(0) for default Sepolia)
     */
    function initialize(
        uint256 _amountUSD,
        uint256 _cycleDuration,
        uint256 _maxMembers,
        address _priceFeedAddress
    ) external {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        if (_priceFeedAddress == address(0)) {
            ethUsdPriceFeed = AggregatorV3Interface(SEPOLIA_ETH_USD_FEED);
        } else {
            ethUsdPriceFeed = AggregatorV3Interface(_priceFeedAddress);
        }
        
        contributionAmountUSD = _amountUSD;
        contributionAmountEth = usdToEth(_amountUSD);
        cycleDuration = _cycleDuration;
        maxMembers = _maxMembers;
        currentCycle = 1;
    }

    /**
     * @notice Allows the admin to pause the contract in case of emergency.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Allows the admin to unpause the contract.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Allows a member to deposit the required contribution amount.
     * @dev Enforces strict deposit of contributionAmountEth and updates pool state.
     * Can only be called when the contract is not paused.
     */
    function deposit() external payable whenNotPaused {
        if(msg.value != contributionAmountEth) revert InvalidContribution();
        if(members.length >= maxMembers) revert AjoIsFull();

        bool isNewMember = balances[msg.sender] == 0;
        if(isNewMember) {
             members.push(msg.sender);
        }

        balances[msg.sender] += msg.value;
        totalPool += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Update contribution amount (recalculates ETH equivalent)
     * @param _newAmountUSD New contribution amount in USD (8 decimals)
     */
    function updateContributionAmount(uint256 _newAmountUSD) external onlyRole(DEFAULT_ADMIN_ROLE) {
        contributionAmountUSD = _newAmountUSD;
        contributionAmountEth = usdToEth(_newAmountUSD);
    }

    /**
     * @notice Get current ETH amount for contribution
     */
    function getContributionAmountEth() external view returns (uint256) {
        return contributionAmountEth;
    }

    /// @notice Get all member addresses
    function getMembers() external view returns (address[] memory) {
        return members;
    }

    /// @notice Get member count
    function memberCount() external view returns (uint256) {
        return members.length;
    }
}
