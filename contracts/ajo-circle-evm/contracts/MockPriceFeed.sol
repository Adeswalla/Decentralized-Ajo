// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockPriceFeed
 * @dev Mock Chainlink Price Feed for testing
 */
contract MockPriceFeed is AggregatorV3Interface {
    int256 private price;
    uint8 private decimals;
    string private description;
    uint256 private version;
    uint80 private roundId;
    uint256 private startedAt;
    uint256 private updatedAt;
    uint80 private answeredInRound;

    constructor() {
        price = 200000000000; // $2000 ETH with 8 decimals
        decimals = 8;
        description = "ETH/USD";
        version = 1;
        roundId = 1;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = 1;
    }

    function decimals() external view override returns (uint8) {
        return decimals;
    }

    function description() external view override returns (string memory) {
        return description;
    }

    function version() external view override returns (uint256) {
        return version;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId_,
            int256 answer,
            uint256 startedAt_,
            uint256 updatedAt_,
            uint80 answeredInRound_
        )
    {
        return (roundId, price, startedAt, updatedAt, answeredInRound);
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId_,
            int256 answer,
            uint256 startedAt_,
            uint256 updatedAt_,
            uint80 answeredInRound_
        )
    {
        return (roundId, price, startedAt, updatedAt, answeredInRound);
    }

    function setPrice(int256 _price) external {
        price = _price;
        roundId++;
        updatedAt = block.timestamp;
        answeredInRound = roundId;
    }
}
