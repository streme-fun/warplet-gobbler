// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IDutchAuction} from "./interfaces/IDutchAuction.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title DutchAuction — "The Gobbler"
/// @notice Receives a Superfluid stream of $WARPGOBB. Anyone can deposit a Warplet and drain the pot.
/// @dev Accepts Warplets via {IERC721Receiver-onERC721Received}. `data` must be `abi.encode(minPrice)`.

contract DutchAuction is IDutchAuction, IERC721Receiver {
    using SafeERC20 for IERC20;

    IERC721 public immutable warplets;      // Warplets NFT contract
    IERC20 public immutable paymentToken;   // token used for payment: $WARPGOBB
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

    /// @inheritdoc IDutchAuction
    function gobble(uint256 tokenId, uint256 minPrice) external override {
        warplets.safeTransferFrom(msg.sender, address(this), tokenId, abi.encode(minPrice));
    }

    /// @inheritdoc IERC721Receiver
    function onERC721Received(address, address from, uint256 tokenId, bytes calldata data)
        external
        override
        returns (bytes4)
    {
        require(msg.sender == address(warplets), "DutchAuction: only Warplets");
        uint256 minPrice = abi.decode(data, (uint256));
        uint256 payout = currentPrice();
        require(payout >= minPrice, "Price is too low, try again later");
        warplets.safeTransferFrom(address(this), nftReserve, tokenId);
        paymentToken.safeTransfer(from, payout);
        emit Gobbled(from, tokenId, payout);
        return IERC721Receiver.onERC721Received.selector;
    }
}
