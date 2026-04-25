// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AjoCircle.sol";

/// @title Ajo Factory
/// @notice Factory for deploying new Ajo Circle instances using minimal proxies (EIP-1167)
contract AjoFactory is Ownable {
    // ═══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice The implementation contract address for Ajo Circle
    address public immutable implementation;

    /// @notice Registry of all deployed Ajo Circle proxy addresses
    mapping(uint256 => address) public ajoRegistry;
    uint256 public registryCount;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event AjoCreated(
        address indexed proxyAddress,
        address indexed organizer,
        address indexed tokenAddress,
        uint256 contributionAmount,
        uint256 frequencyDays,
        uint256 maxRounds,
        uint256 maxMembers
    );

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Initialize the factory with the Ajo Circle implementation
    /// @param _implementation Address of the AjoCircle implementation contract
    constructor(address _implementation) Ownable(msg.sender) {
        if (_implementation == address(0)) {
            // If no implementation provided, deploy one
            implementation = address(new AjoCircle());
        } else {
            implementation = _implementation;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Create a new Ajo Circle instance using EIP-1167 minimal proxy
    /// @param _tokenAddress Token contract address
    /// @param _contributionAmount Required contribution per round
    /// @param _frequencyDays Round duration in days
    /// @param _maxRounds Total number of rounds
    /// @param _maxMembers Maximum member capacity
    /// @return proxyAddress The address of the newly deployed Ajo proxy
    function createAjo(
        address _tokenAddress,
        uint256 _contributionAmount,
        uint256 _frequencyDays,
        uint256 _maxRounds,
        uint256 _maxMembers
    ) external returns (address proxyAddress) {
        // Deploy proxy using Clones (EIP-1167)
        proxyAddress = Clones.clone(implementation);

        // Initialize the new instance
        // Using the logic mentioned in requirements: initializing the new instance
        AjoCircle(proxyAddress).initialize(
            msg.sender,
            _tokenAddress,
            _contributionAmount,
            _frequencyDays,
            _maxRounds,
            _maxMembers
        );

        // Track in registry
        ajoRegistry[registryCount] = proxyAddress;
        registryCount++;

        emit AjoCreated(
            proxyAddress,
            msg.sender,
            _tokenAddress,
            _contributionAmount,
            _frequencyDays,
            _maxRounds,
            _maxMembers
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // QUERY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Get the total number of deployed Ajo circles
    function getRegistryLength() external view returns (uint256) {
        return registryCount;
    }

    /// @notice Get a slice of deployed Ajo circle addresses
    /// @param _offset Starting index
    /// @param _limit Maximum number of addresses to return
    function getRegistrySlice(uint256 _offset, uint256 _limit) external view returns (address[] memory) {
        uint256 count = _limit;
        if (_offset + _limit > registryCount) {
            count = registryCount > _offset ? registryCount - _offset : 0;
        }

        address[] memory slice = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            slice[i] = ajoRegistry[_offset + i];
        }
        return slice;
    }
}
