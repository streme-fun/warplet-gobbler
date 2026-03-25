// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IDutchAuction} from "./interfaces/IDutchAuction.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DutchAuction — "The Gobbler"
/// @notice Receives a Superfluid stream of USDCx. Anyone can deposit a Warplet and drain the pot.

contract DutchAuction is IDutchAuction {
    IERC721 public immutable warplets;      // Warplets NFT contract
    IERC20 public immutable paymentToken;   // USDCx
    address public immutable nftReserve;    // Where gobbled Warplets go next

    event Gobbled(address indexed buyer, uint256 tokenId, uint256 amount);

    function currentPrice() external view override returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }

    function gobble(uint256 tokenId) external override {
        warplets.safeTransferFrom(msg.sender, nftReserve, tokenId);
        paymentToken.transferFrom(address(this), msg.sender, currentPrice());
        emit Gobbled(msg.sender, tokenId, currentPrice());
    }
}
