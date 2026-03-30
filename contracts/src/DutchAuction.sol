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

    // @public
    // _feeHandler gets an allowance to withdraw balance when switching to a new auction contract
    constructor(address _warplets, address _paymentToken, address _nftReserve, address _feeHandler) {
        warplets = IERC721(_warplets);
        paymentToken = IERC20(_paymentToken);
        nftReserve = _nftReserve;
        paymentToken.approve(_feeHandler, type(uint256).max);
    }

    function currentPrice() public view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }

    function gobble(uint256 tokenId, uint256 minPrice) external override {
        uint256 payout = currentPrice();
        warplets.safeTransferFrom(msg.sender, nftReserve, tokenId);
        require(payout >= minPrice, "Price is too low, try again later");
        paymentToken.transfer(msg.sender, payout);
        emit Gobbled(msg.sender, tokenId, payout);
    }
}
