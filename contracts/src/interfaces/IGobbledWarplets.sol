// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IGobbledWarplets
/// @notice Gobbled Warplet receipt: minter reserves a token id for the winner; the winner later either
///         walks away with just the underlying Warplet (`rescueWarplet(tokenId)`) or claims the receipt
///         with signed metadata AND the underlying Warplet in one tx (`rescueWarplet(tokenId, uri, deadline, sig)`).
interface IGobbledWarplets {
    /// @notice Reserve the next gobbled receipt for `warpletId` to `to` (minter only — typically `AuctionSell` on settlement).
    /// @dev `warpletId` must be less than `WARPLET_ID_PADDING` on the receipt contract (1e8).
    /// @return tokenId Encoded id: `gobbleIndex * WARPLET_ID_PADDING + warpletId`
    function reserve(address to, uint256 warpletId) external returns (uint256 tokenId);
}
