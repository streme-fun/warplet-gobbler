// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IDutchAuction — "The Gobbler"
/// @notice Receives a Superfluid stream of $WARPGOBB. Anyone can deposit a Warplet NFT
///         and drain the entire balance. Price rises continuously as the stream fills the pot.
/// @dev `DutchAuctionV2` adds `gobbleFlash` (see that contract); cast addresses when needed.
interface IDutchAuction {
    function warplets() external view returns (IERC721);
    function paymentToken() external view returns (IERC20);
    function nftReserve() external view returns (address);

    /// @notice Current balance available (i.e. the current "price" of depositing a Warplet)
    function currentPrice() external view returns (uint256);

    /// @notice Deposit a Warplet NFT and receive the full pot balance (ERC-721 `safeTransferFrom` into this contract).
    /// @param tokenId The Warplet token ID to deposit
    /// @param minPrice Minimum acceptable payout; encoded as `data` for `onERC721Received` (`abi.encode(minPrice)`).
    function gobble(uint256 tokenId, uint256 minPrice) external;

    /// @notice Emitted when a Warplet is gobbled
    event Gobbled(address indexed seller, uint256 indexed tokenId, uint256 payout);
}
