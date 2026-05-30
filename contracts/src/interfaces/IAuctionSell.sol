// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IGobbledWarplets} from "./IGobbledWarplets.sol";
import {INFTReserve} from "./INFTReserve.sol";

/// @title IAuctionSell
/// @notice Nouns-style highest-bidder auction for Warplets. Bids in an ERC20 / ERC777 `bidToken`.
///         Native ETH bids optionally route through `stremeZap`. Matches `AuctionSell.sol`.
/// @dev `auction` is a public state variable on the contract (struct getter). Events are declared on `AuctionSell`.
///      ERC777 `tokensReceived` is `IERC777Recipient` on the contract, not repeated here (dual-override).
interface IAuctionSell {
    function nft() external view returns (IERC721);
    function bidToken() external view returns (IERC20);
    function gobbledWarplets() external view returns (IGobbledWarplets);
    function nftReserve() external view returns (INFTReserve);

    /// @notice Optional zap used for native ETH bids (`msg.value > 0` on `bid`).
    function stremeZap() external view returns (address);
    function proceedsRecipient() external view returns (address);
    function timeBuffer() external view returns (uint256);
    function reservePrice() external view returns (uint256);
    function minBidIncrementPercentage() external view returns (uint8);
    function duration() external view returns (uint256);

    function queueBumpFee() external view returns (uint256);

    function queuedLength() external view returns (uint256);
    function getQueuedTokenIds() external view returns (uint256[] memory orderedIds);
    function nextQueuedTokenId() external view returns (uint256);

    /// @notice Place a bid on the current Warplet auction
    /// @param amount The bid token amount
    /// @dev Payable: with `msg.value > 0`, swaps via `StremeZapUniversal` to this auction's `bidToken` then bids;
    ///      with `msg.value == 0`, pulls `amount` from the caller with `transferFrom` (or ERC777 send path).
    function bid(uint256 amount) external payable;

    function bump(uint256 tokenId, uint256 prev) external;

    /// @notice Settle the current auction and start the next from the queue (normal user path)
    function settleCurrentAndCreateNewAuction() external;

    /// @notice Settle the current auction only while the contract is paused (emergency / migration path).
    ///         Does not start the next auction — use `settleCurrentAndCreateNewAuction` when unpaused.
    function settle() external;

    /// @notice Start a new auction with a gobbled Warplet
    /// @param tokenId The Warplet token ID to auction
    function startAuction(uint256 tokenId) external;

    /// @notice Current auction details (zeros when none live).
    function currentAuction()
        external
        view
        returns (uint256 tokenId, address highBidder, uint256 highBid, uint256 endTime);

    function extendAuction() external;
    function pause() external;
    function unpause() external;
    function setTimeBuffer(uint256 _timeBuffer) external;
    function setReservePrice(uint256 _reservePrice) external;
    function setMinBidIncrementPercentage(uint8 _minBidIncrementPercentage) external;
    function setProceedsRecipient(address _proceedsRecipient) external;
    function setQueueBumpFee(uint256 _queueBumpFee) external;

    event AuctionStarted(uint256 indexed tokenId, uint256 endTime);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount, uint256 gobbledTokenId);
}
