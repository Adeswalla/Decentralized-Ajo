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
    
    /// @notice List of all deployed Ajo clones
    address[] public deployedAjos;

    /// @notice Event emitted when a new Ajo clone is created
    event Created(address indexed newAjo, address indexed creator);

    /**
     * @dev Sets the implementation contract address
     * @param _implementation The address of the logic contract
     */
    constructor(address _implementation) {
        require(_implementation != address(0), "Implementation cannot be zero");
        implementation = _implementation;
    }

    /**
     * @notice Creates a new Ajo pool clone
     * @param _amount The contribution amount required for the pool
     * @param _maxMembers The maximum number of members allowed
     */
    function createAjo(uint256 _amount, uint32 _maxMembers) external returns (address) {
        address clone = Clones.clone(implementation);
        Ajo(clone).initialize(_amount, _maxMembers, msg.sender);
        
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
