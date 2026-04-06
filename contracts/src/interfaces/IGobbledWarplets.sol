// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IGobbledWarplets
/// @notice Receipt NFT minted when a Warplet auction settles (one receipt per successful gobble).
interface IGobbledWarplets {
    /// @notice Mint a gobbled Warplet receipt to `to` for underlying `warpletId`.
    /// @return tokenId Encoded id: `gobbleIndex * 1e6 + warpletId`
    function mint(address to, uint256 warpletId) external returns (uint256 tokenId);
}
