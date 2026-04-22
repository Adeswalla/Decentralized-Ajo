// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
// Custom Errors
// ─────────────────────────────────────────────────────────────────────────────

/// @dev Caller is not the expected receiver for the current cycle.
error UnauthorizedCycle();

/// @dev The pool has not yet reached the required contribution threshold.
error PoolIncomplete();

/// @dev currentCycle would exceed the members array — all cycles are complete.
error CycleExceeded();

/// @dev Low-level ETH transfer to the receiver failed.
error TransferFailed();

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

/// @title  DecentralizedAjo
/// @notice Implements a rotating savings circle (Ajo/Esusu/Tanda) on-chain.
///         Each cycle, the designated member withdraws the full pooled amount
///         once all contributions have been collected.
contract DecentralizedAjo {
    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice Ordered list of member addresses; index determines payout order.
    address[] public members;

    /// @notice Fixed contribution amount each member must deposit per cycle.
    uint256 public contributionAmount;

    /// @notice Running total of ETH held in the pool.
    uint256 public totalPool;

    /// @notice Current cycle index, starting at 1.
    ///         Maps to members[currentCycle - 1] for the expected receiver.
    uint256 public currentCycle;

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a member successfully withdraws the pool.
    /// @param receiver The address that received the payout.
    /// @param cycle    The cycle number that was completed.
    /// @param amount   The ETH amount transferred.
    event CycleCompleted(address indexed receiver, uint256 cycle, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @param _members            Ordered array of participant addresses.
    /// @param _contributionAmount Fixed ETH amount each member contributes.
    constructor(address[] memory _members, uint256 _contributionAmount) {
        require(_members.length > 0, "No members");
        require(_contributionAmount > 0, "Invalid amount");
        members = _members;
        contributionAmount = _contributionAmount;
        currentCycle = 1;
    }

    // ── Core Functions ────────────────────────────────────────────────────────

    /// @notice Allows the designated member for the current cycle to withdraw
    ///         the full pool once all contributions have been collected.
    /// @dev    Implements the Checks-Effects-Interactions (CEI) pattern.
    ///         State variables `totalPool` and `currentCycle` are updated
    ///         before the external call to prevent reentrancy exploits.
    ///         Uses a low-level `.call` for ETH transfer per modern best practice.
    function withdraw() external {
        // ── Checks ────────────────────────────────────────────────────────────

        // Guard: all cycles must not already be exhausted
        if (currentCycle > members.length) revert CycleExceeded();

        // Derive expected receiver: cycle 1 → members[0], cycle 2 → members[1], …
        address expectedReceiver = members[currentCycle - 1];

        // Only the designated member may trigger this cycle's withdrawal
        if (msg.sender != expectedReceiver) revert UnauthorizedCycle();

        // Pool must equal contributionAmount × total number of members
        uint256 required = contributionAmount * members.length;
        if (totalPool < required) revert PoolIncomplete();

        // ── Effects ───────────────────────────────────────────────────────────

        uint256 amount = totalPool;
        totalPool = 0;
        currentCycle += 1;

        // ── Interactions ──────────────────────────────────────────────────────

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit CycleCompleted(expectedReceiver, currentCycle - 1, amount);
    }

    /// @notice Accepts ETH contributions into the pool.
    /// @dev    In production, replace with a dedicated `contribute()` function
    ///         that validates the sender is a registered member.
    receive() external payable {
        totalPool += msg.value;
    }
}
