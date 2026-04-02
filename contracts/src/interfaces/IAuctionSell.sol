// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IAuctionSell
/// @notice Simple highest-bidder auction for Warplet NFTs. Bids denominated in $STRAT.
///         Based on Mark's DegenDogs auction contract.
interface IAuctionSell {
    /// @notice Place a bid on the current Warplet auction
    /// @param amount The $STRAT amount to bid
    function bid(uint256 amount) external;

    /// @notice Settle the current auction and start the next from the queue (normal user path)
    function settleCurrentAndCreateNewAuction() external;

    /// @notice Settle the current auction only while the contract is paused (emergency / migration path).
    ///         Does not start the next auction — use `settleCurrentAndCreateNewAuction` when unpaused.
    function settle() external;

    /// @notice Start a new auction with a gobbled Warplet
    /// @param tokenId The Warplet token ID to auction
    function startAuction(uint256 tokenId) external;

    /// @notice Current auction details
    function currentAuction()
        external
        view
        returns (
            uint256 tokenId,
            address highBidder,
            uint256 highBid,
            uint256 endTime
        );

    event AuctionStarted(uint256 indexed tokenId, uint256 endTime);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    /// @param gobbledTokenId Newly minted GobbledWarplets receipt id (URI may be set later via `setTokenURI`).
    event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount, uint256 gobbledTokenId);
}
