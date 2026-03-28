// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IDutchAuction — "The Gobbler"
/// @notice Receives a Superfluid stream of USDCx. Anyone can deposit a Warplet NFT
///         and drain the entire balance. Price rises continuously as the stream fills the pot.
interface IDutchAuction {
    /// @notice Current balance available (i.e. the current "price" of depositing a Warplet)
    function currentPrice() external view returns (uint256);

    /// @notice Deposit a Warplet NFT and receive the full pot balance
    /// @param tokenId The Warplet token ID to deposit
    /// @param minPrice Minimum acceptable payout to protect from stale mempool price movement
    function gobble(uint256 tokenId, uint256 minPrice) external;

    /// @notice Emitted when a Warplet is gobbled
    event Gobbled(address indexed seller, uint256 indexed tokenId, uint256 payout);
}
