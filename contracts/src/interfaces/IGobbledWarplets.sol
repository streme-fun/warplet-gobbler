// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IGobbledWarplets
/// @notice Gobbled Warplet receipt: reserve books a token id for the winner; the winner later either
///         walks away with just the underlying Warplet (`rescueWarplet(tokenId)`) or claims the receipt
///         with signed metadata AND the underlying Warplet in one tx (`rescueWarplet(tokenId, uri, deadline, sig)`).
/// @dev Events are declared on `GobbledWarplets` (see that contract). This interface lists the external API only.
interface IGobbledWarplets {
    function WARPLET_ID_PADDING() external view returns (uint256);
    function nftReserve() external view returns (address);
    function auction() external view returns (address);
    function tokenURISetter() external view returns (address);
    function warplets() external view returns (IERC721);

    function warpletRescued(uint256 tokenId) external view returns (bool);

    function setTokenURISetter(address newTokenURISetter) external;

    /// @notice Syncs `GobbledWarplets.auction` with `NFTReserve.auction`. Only `nftReserve` may call.
    function setAuction(address newAuction) external;

    /// @notice Reserves the next gobbled receipt slot for `warpletId` in favor of `to` (winner).
    /// @dev Only `GobbledWarplets.auction` (the live auction runner, e.g. `AuctionSell`).
    ///      `warpletId` must be less than `WARPLET_ID_PADDING` on the receipt contract (1e8).
    /// @return tokenId Encoded id: `gobbleIndex * WARPLET_ID_PADDING + warpletId`
    function createReceipt(address to, uint256 warpletId) external returns (uint256 tokenId);

    function rescueWarplet(uint256 tokenId) external;

    function rescueWarplet(uint256 tokenId, string calldata uri, uint256 deadline, bytes calldata signature)
        external;

    function gobbleCount(uint256 warpletId) external view returns (uint256);
    function warpletOf(uint256 tokenId) external view returns (uint256);
    function gobbleIndexOf(uint256 tokenId) external view returns (uint256);
}
