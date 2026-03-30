// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Ajo.sol";

/**
 * @title AjoFactory
 * @dev Factory contract for deploying Ajo clones using EIP-1167.
 * This approach reduces deployment costs significantly.
 */
contract AjoFactory {
    /// @notice The address of the Ajo implementation contract
    address public immutable implementation;
    
    /// @notice Chainlink ETH/USD price feed address
    address public priceFeed;
    
    /// @notice List of all deployed Ajo clones
    address[] public deployedAjos;

    /// @notice Event emitted when a new Ajo clone is created
    event Created(address indexed newAjo, address indexed creator);

    /**
     * @dev Sets the implementation contract address and price feed
     * @param _implementation The address of the logic contract
     * @param _priceFeed The Chainlink ETH/USD price feed address
     */
    constructor(address _implementation, address _priceFeed) {
        require(_implementation != address(0), "Implementation cannot be zero");
        implementation = _implementation;
        priceFeed = _priceFeed;
    }

    /**
     * @notice Creates a new Ajo pool clone
     * @param _amountUSD The contribution amount in USD (8 decimals)
     * @param _cycleDuration Duration of each cycle in seconds
     * @param _maxMembers The maximum number of members allowed
     */
    function createAjo(uint256 _amountUSD, uint256 _cycleDuration, uint32 _maxMembers) external returns (address) {
        address clone = Clones.clone(implementation);
        Ajo(clone).initialize(_amountUSD, _cycleDuration, _maxMembers, priceFeed);
        
        deployedAjos.push(clone);
        emit Created(clone, msg.sender);
        
        return clone;
    }

    /**
     * @notice Returns the total number of deployed Ajos
     */
    function getDeployedAjosCount() external view returns (uint256) {
        return deployedAjos.length;
    }

    /**
     * @notice Returns all deployed Ajo addresses
     */
    function getDeployedAjos() external view returns (address[] memory) {
        return deployedAjos;
    }
}
