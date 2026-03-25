// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAuctionSell} from "./interfaces/IAuctionSell.sol";

/// @title AuctionSell
/// @notice Highest-bidder auction for gobbled Warplets. Bids in $STRAT.
/// @dev TODO: Mark to adapt from DegenDogs auction contract. Key decisions:
///      - Auction duration (24h? 48h? configurable?)
///      - Minimum bid / reserve price?
///      - What happens if auction gets no bids? (return to gobbler? relist?)
///      - $STRAT proceeds go to staking contract — direct transfer or stream?
contract AuctionSell is IAuctionSell {
    // address public immutable stratToken;     // $STRAT token
    // address public immutable staking;        // Staking contract — receives auction proceeds
    // address public immutable warplets;       // Warplets NFT contract

    function bid(uint256 /* amount */) external override {
        revert("not implemented");
    }

    function settle() external override {
        revert("not implemented");
    }

    function startAuction(uint256 /* tokenId */) external override {
        revert("not implemented");
    }

    function currentAuction()
        external
        pure
        override
        returns (uint256, address, uint256, uint256)
    {
        revert("not implemented");
    }
}
