// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IGobbledWarplets} from "./IGobbledWarplets.sol";

/// @notice Custody + FIFO-style linked queue for one ERC-721 collection; one authorized auction mutates the queue.
/// @dev Matches `NFTReserve.sol`. ERC-721 hook is `IERC721Receiver` on the contract. Events are declared on `NFTReserve`.
interface INFTReserve {
    function nft() external view returns (IERC721);
    function gobbledWarplets() external view returns (IGobbledWarplets);
    function auction() external view returns (address);
    function head() external view returns (uint256);
    function tail() external view returns (uint256);
    function queuedLength() external view returns (uint256);
    function nextTokenId(uint256 tokenId) external view returns (uint256);
    function getQueuedTokenIds() external view returns (uint256[] memory orderedIds);

    function setGobbledWarplets(IGobbledWarplets newGobbledWarplets) external;
    function setAuction(address newAuction) external;

    /// @param insertAfter Queue node to insert `tokenId` after; `0` means prepend (new head).
    function splice(uint256 tokenId, uint256 prev, uint256 insertAfter) external;

    function popHead() external returns (uint256 tokenId);

    function pop(uint256 tokenId, uint256 prev) external returns (uint256 poppedId);
}
