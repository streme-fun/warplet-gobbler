// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IGobbledWarplets
/// @notice Gobbled Warplet receipt: minter reserves a token id for the winner; the winner completes the NFT via {mint} + signature.
interface IGobbledWarplets {
    /// @notice Reserve the next gobbled receipt for `warpletId` to `to` (minter only — typically `AuctionSell` on settlement).
    /// @dev `warpletId` must be less than `MAX_WARPLET_ID_EXCLUSIVE` on the receipt contract.
    /// @return tokenId Encoded id: `gobbleIndex * TOKEN_ID_DECIMAL_STRIDE + warpletId`
    function reserve(address to, uint256 warpletId) external returns (uint256 tokenId);
}
