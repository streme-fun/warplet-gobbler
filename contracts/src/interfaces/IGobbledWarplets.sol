// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IGobbledWarplets
/// @notice Gobbled Warplet receipt: minter reserves a token id for the winner; the winner claims via
///         `rescueWarplet(tokenId, uri, deadline, sig)` (pulls the underlying Warplet when still in the auction).
interface IGobbledWarplets {
    /// @notice Reserve the next gobbled receipt for `warpletId` to `to` (minter only — typically `AuctionSell` on settlement).
    /// @dev `warpletId` must be less than `WARPLET_ID_PADDING` on the receipt contract (1e8).
    /// @return tokenId Encoded id: `gobbleIndex * WARPLET_ID_PADDING + warpletId`
    function reserve(address to, uint256 warpletId) external returns (uint256 tokenId);
}
