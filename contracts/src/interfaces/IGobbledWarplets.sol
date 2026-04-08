// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IGobbledWarplets
/// @notice Receipt NFT minted when a Warplet auction settles (one receipt per successful gobble).
interface IGobbledWarplets {
    /// @notice Mint a gobbled Warplet receipt to `to` for underlying `warpletId`.
    /// @dev `warpletId` must be less than the receipt contract's `MAX_WARPLET_ID_EXCLUSIVE` (equals `TOKEN_ID_DECIMAL_STRIDE`, 1e8 in the canonical deployment).
    /// @return tokenId Encoded id: `gobbleIndex * TOKEN_ID_DECIMAL_STRIDE + warpletId`
    function mint(address to, uint256 warpletId) external returns (uint256 tokenId);
}
