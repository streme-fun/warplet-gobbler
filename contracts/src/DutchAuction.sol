// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IDutchAuction} from "./interfaces/IDutchAuction.sol";

/// @title DutchAuction — "The Gobbler"
/// @notice Receives a Superfluid stream of USDCx. Anyone can deposit a Warplet and drain the pot.
/// @dev TODO: Pierre/Fran to implement. Key decisions:
///      - Superfluid CFA or GDA for the incoming stream?
///      - Does the contract need to be a Super App to receive streams?
///      - How does the gobbled Warplet get forwarded to AuctionSell?
///        Option A: DutchAuction calls auctionSell.startAuction() directly
///        Option B: Separate keeper/bot moves NFTs between contracts
contract DutchAuction is IDutchAuction {
    // address public immutable warplets;      // Warplets NFT contract
    // address public immutable paymentToken;   // USDCx
    // address public immutable auctionSell;    // Where gobbled Warplets go next

    function currentPrice() external view override returns (uint256) {
        // return paymentToken.balanceOf(address(this));
        revert("not implemented");
    }

    function gobble(uint256 /* tokenId */) external override {
        // 1. Transfer Warplet from msg.sender to this contract (or directly to auctionSell)
        // 2. Transfer full USDCx balance to msg.sender
        // 3. Forward Warplet to auctionSell
        // 4. Emit Gobbled event
        revert("not implemented");
    }
}
