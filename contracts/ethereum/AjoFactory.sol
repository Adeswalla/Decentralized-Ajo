// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AjoFactory
 * @dev Factory contract for creating and managing Ajo circles (savings groups) on Ethereum
 * 
 * Ajo (also known as Rotating Savings and Credit Association - ROSCA) is a mutual help
 * society where members take turns receiving the pooled savings. This contract manages
 * the creation and tracking of Ajo circles on the blockchain.
 */

contract AjoFactory {
    // ========================================================================
    // State Variables
    // ========================================================================

    /// @dev Mapping of circle ID to circle details
    mapping(uint256 => Circle) public circles;

    /// @dev Counter for circle IDs
    uint256 public circleCounter;

    /// @dev Mapping of user address to their circle IDs
    mapping(address => uint256[]) public userCircles;

    /// @dev Platform fee in basis points (e.g., 100 = 1%)
    uint256 public platformFee = 100; // 1% by default

    /// @dev Platform owner who can manage fees
    address public platformOwner;

    // ========================================================================
    // Data Structures
    // ========================================================================

    struct Circle {
        uint256 id;
        string name;
        address creator;
        uint256 createdAt;
        uint256 contributionAmount;
        uint256 contributionFrequency; // in seconds
        uint256 nextPayout;
        CircleStatus status;
        address[] members;
        uint256 totalPooled;
        bool exists;
    }

    enum CircleStatus {
        PENDING,
        ACTIVE,
        COMPLETED,
        CANCELLED
    }

    // ========================================================================
    // Events
    // ========================================================================

    event CircleCreated(
        uint256 indexed circleId,
        string name,
        address indexed creator,
        uint256 contributionAmount,
        uint256 frequency
    );

    event CircleStatusChanged(uint256 indexed circleId, CircleStatus newStatus);

    event MemberJoined(uint256 indexed circleId, address indexed member);

    event ContributionReceived(
        uint256 indexed circleId,
        address indexed contributor,
        uint256 amount
    );

    event PlatformFeeUpdated(uint256 newFee);

    event PlatformOwnerUpdated(address newOwner);

    // ========================================================================
    // Modifiers
    // ========================================================================

    modifier onlyPlatformOwner() {
        require(
            msg.sender == platformOwner,
            "AjoFactory: Only platform owner can call this"
        );
        _;
    }

    modifier circleExists(uint256 _circleId) {
        require(circles[_circleId].exists, "AjoFactory: Circle does not exist");
        _;
    }

    modifier onlyCircleCreator(uint256 _circleId) {
        require(
            msg.sender == circles[_circleId].creator,
            "AjoFactory: Only circle creator can call this"
        );
        _;
    }

    // ========================================================================
    // Constructor
    // ========================================================================

    constructor() {
        platformOwner = msg.sender;
        circleCounter = 0;
    }

    // ========================================================================
    // Circle Management Functions
    // ========================================================================

    /**
     * @dev Create a new Ajo circle
     * @param _name Name of the circle
     * @param _contributionAmount Amount each member contributes per cycle
     * @param _frequency Contribution frequency in seconds (e.g., 2592000 for 30 days)
     * @return circleId The ID of the newly created circle
     */
    function createCircle(
        string memory _name,
        uint256 _contributionAmount,
        uint256 _frequency
    ) public returns (uint256) {
        require(
            _contributionAmount > 0,
            "AjoFactory: Contribution amount must be greater than 0"
        );
        require(
            _frequency > 0,
            "AjoFactory: Frequency must be greater than 0"
        );
        require(bytes(_name).length > 0, "AjoFactory: Name cannot be empty");

        uint256 circleId = circleCounter++;

        Circle storage newCircle = circles[circleId];
        newCircle.id = circleId;
        newCircle.name = _name;
        newCircle.creator = msg.sender;
        newCircle.createdAt = block.timestamp;
        newCircle.contributionAmount = _contributionAmount;
        newCircle.contributionFrequency = _frequency;
        newCircle.nextPayout = block.timestamp + _frequency;
        newCircle.status = CircleStatus.PENDING;
        newCircle.totalPooled = 0;
        newCircle.exists = true;

        newCircle.members.push(msg.sender);
        userCircles[msg.sender].push(circleId);

        emit CircleCreated(
            circleId,
            _name,
            msg.sender,
            _contributionAmount,
            _frequency
        );

        return circleId;
    }

    /**
     * @dev Join an existing circle
     * @param _circleId The ID of the circle to join
     */
    function joinCircle(uint256 _circleId) public circleExists(_circleId) {
        Circle storage circle = circles[_circleId];

        require(
            circle.status == CircleStatus.PENDING ||
                circle.status == CircleStatus.ACTIVE,
            "AjoFactory: Cannot join circle in this status"
        );

        // Check if already a member
        for (uint256 i = 0; i < circle.members.length; i++) {
            require(
                circle.members[i] != msg.sender,
                "AjoFactory: Already a member of this circle"
            );
        }

        circle.members.push(msg.sender);
        userCircles[msg.sender].push(_circleId);

        // Activate circle if it has enough members (optional: set minimum)
        if (circle.members.length >= 2 && circle.status == CircleStatus.PENDING) {
            circle.status = CircleStatus.ACTIVE;
            emit CircleStatusChanged(_circleId, CircleStatus.ACTIVE);
        }

        emit MemberJoined(_circleId, msg.sender);
    }

    /**
     * @dev Contribute to a circle
     * @param _circleId The ID of the circle to contribute to
     */
    function contributeToCircle(uint256 _circleId)
        public
        payable
        circleExists(_circleId)
    {
        // Cache config: Read circle data once into memory to minimize storage reads
        Circle memory circleData = circles[_circleId];

        require(
            circleData.status == CircleStatus.ACTIVE,
            "AjoFactory: Circle is not active"
        );

        require(
            msg.value == circleData.contributionAmount,
            "AjoFactory: Incorrect contribution amount"
        );

        // Verify the contributor is a member using cached member list
        bool isMember = false;
        for (uint256 i = 0; i < circleData.members.length; i++) {
            if (circleData.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "AjoFactory: Not a member of this circle");

        // Update storage with new pooled amount
        circles[_circleId].totalPooled = circleData.totalPooled + msg.value;

        emit ContributionReceived(_circleId, msg.sender, msg.value);
    }

    /**
     * @dev Get circle details
     * @param _circleId The ID of the circle
     * @return The circle details
     */
    function getCircle(uint256 _circleId)
        public
        view
        circleExists(_circleId)
        returns (Circle memory)
    {
        return circles[_circleId];
    }

    /**
     * @dev Get all circles for a user
     * @param _user The user address
     * @return Array of circle IDs
     */
    function getUserCircles(address _user)
        public
        view
        returns (uint256[] memory)
    {
        return userCircles[_user];
    }

    /**
     * @dev Get circle members
     * @param _circleId The ID of the circle
     * @return Array of member addresses
     */
    function getCircleMembers(uint256 _circleId)
        public
        view
        circleExists(_circleId)
        returns (address[] memory)
    {
        return circles[_circleId].members;
    }

    /**
     * @dev Check if address is member of circle
     * @param _circleId The ID of the circle
     * @param _member The address to check
     * @return True if member, false otherwise
     */
    function isMember(uint256 _circleId, address _member)
        public
        view
        circleExists(_circleId)
        returns (bool)
    {
        Circle memory circle = circles[_circleId];
        for (uint256 i = 0; i < circle.members.length; i++) {
            if (circle.members[i] == _member) {
                return true;
            }
        }
        return false;
    }

    // ========================================================================
    // Platform Management Functions
    // ========================================================================

    /**
     * @dev Update platform fee
     * @param _newFee New fee in basis points (100 = 1%)
     */
    function setPlatformFee(uint256 _newFee) public onlyPlatformOwner {
        require(_newFee <= 10000, "AjoFactory: Fee cannot exceed 100%");
        platformFee = _newFee;
        emit PlatformFeeUpdated(_newFee);
    }

    /**
     * @dev Transfer platform ownership
     * @param _newOwner Address of new owner
     */
    function transferPlatformOwnership(address _newOwner)
        public
        onlyPlatformOwner
    {
        require(_newOwner != address(0), "AjoFactory: Invalid address");
        platformOwner = _newOwner;
        emit PlatformOwnerUpdated(_newOwner);
    }

    // ========================================================================
    // Emergency Functions
    // ========================================================================

    /**
     * @dev Cancel a circle (only creator)
     * @param _circleId The ID of the circle to cancel
     */
    function cancelCircle(uint256 _circleId)
        public
        circleExists(_circleId)
        onlyCircleCreator(_circleId)
    {
        // Cache config: Read circle status once into memory
        CircleStatus currentStatus = circles[_circleId].status;

        require(
            currentStatus != CircleStatus.CANCELLED,
            "AjoFactory: Circle already cancelled"
        );

        circles[_circleId].status = CircleStatus.CANCELLED;
        emit CircleStatusChanged(_circleId, CircleStatus.CANCELLED);
    }

    /**
     * @dev Withdraw contract balance (emergency only)
     */
    function emergencyWithdraw() public onlyPlatformOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "AjoFactory: No balance to withdraw");
        
        (bool success, ) = platformOwner.call{value: balance}("");
        require(success, "AjoFactory: Withdrawal failed");
    }

    // ========================================================================
    // Receive Function
    // ========================================================================

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}
