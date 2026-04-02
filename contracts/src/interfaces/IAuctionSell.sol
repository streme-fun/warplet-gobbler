// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IAuctionSell
/// @notice Simple highest-bidder auction for Warplet NFTs. Bids denominated in the bid token.
///         Based on Mark's DegenDogs auction contract.
interface IAuctionSell {
    /// @notice Place a bid on the current Warplet auction
    /// @param amount The bid token amount
    function bid(uint256 amount) external;

    /// @notice Settle the current auction — transfers NFT to winner, proceeds to staking
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
    event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount);
}
