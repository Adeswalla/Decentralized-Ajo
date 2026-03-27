// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Ajo
 * @dev The foundational smart contract establishing an Ajo pool containing members, cycle duration, and deposit targets.
 */
contract Ajo {
    /// @notice The amount each member must contribute in each cycle
    uint256 public contributionAmount;

    /// @notice The duration of each cycle in seconds
    uint256 public cycleDuration;

    /// @notice The maximum number of members allowed in the pool
    uint256 public maxMembers;

    /// @notice List of all members in the Ajo pool
    mapping(uint256 => address) public members;
    uint256 public membersCount;

    /// @notice Mapping from member address to their current balance in the pool
    mapping(address => uint256) public balances;

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

    /**
     * @dev Initializes the Ajo pool with core parameters
     * @param _contributionAmount The amount required for each contribution
     * @param _cycleDuration The length of time for one cycle
     * @param _maxMembers The maximum capacity of the pool
     */
    constructor(
        uint256 _contributionAmount,
        uint256 _cycleDuration,
        uint256 _maxMembers
    ) {
        contributionAmount = _contributionAmount;
        cycleDuration = _cycleDuration;
        maxMembers = _maxMembers;
    }
}
