// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGobbledWarplets} from "./interfaces/IGobbledWarplets.sol";
import {INFTReserve} from "./interfaces/INFTReserve.sol";

/// @title NFTReserve
/// @notice Stable custody + queue for Warplets. Auction logic mutates queue through `onlyAuction` methods.
/// @dev Queue is singly linked with token id `0` as sentinel. Warplets token id `0` is assumed unused.
contract NFTReserve is Ownable, IERC721Receiver, INFTReserve {
    IERC721 public immutable nft;
    IGobbledWarplets public gobbledWarplets;

    address public auction;

    uint256 public head;
    uint256 public tail;
    uint256 public queuedCount;
    mapping(uint256 tokenId => uint256 nextTokenId) private _nextToken;

    event AuctionUpdated(address indexed newAuction);
    event GobbledWarpletsUpdated(address indexed gobbledWarplets);
    event TokenEnqueued(uint256 indexed tokenId);
    event QueueSpliced(uint256 indexed tokenId, uint256 indexed prev, uint256 indexed insertAfter);
    event QueuePopped(uint256 indexed tokenId);

    modifier onlyAuction() {
        require(msg.sender == auction, "NFTReserve: not auction");
        _;
    }

    /// @dev Queued spine: interior nodes have non-zero `_nextToken`; tail has zero next but `tail == tokenId`.
    function _isQueued(uint256 tokenId) private view returns (bool) {
        return _nextToken[tokenId] != 0 || tail == tokenId;
    }

    constructor(IERC721 _nft, address initialOwner, address initialAuction) Ownable(initialOwner) {
        require(address(_nft) != address(0), "NFTReserve: zero nft");
        nft = _nft;
    }

    function setGobbledWarplets(IGobbledWarplets newGobbledWarplets) external onlyOwner {
        require(address(newGobbledWarplets) != address(0), "NFTReserve: zero gobbled");
        require(address(gobbledWarplets) == address(0), "NFTReserve: gobbled already set");
        gobbledWarplets = newGobbledWarplets;
        // GobbledWarplets pulls reserved underlying NFTs from this reserve during rescue.
        nft.setApprovalForAll(address(newGobbledWarplets), true);
        emit GobbledWarpletsUpdated(address(newGobbledWarplets));
    }

    function setAuction(address newAuction) external onlyOwner {
        auction = newAuction;
        gobbledWarplets.setAuction(newAuction);
        emit AuctionUpdated(newAuction);
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        require(msg.sender == address(nft), "NFTReserve: only configured NFT");
        require(!_isQueued(tokenId), "NFTReserve: already queued");

        if (head == 0) {
            head = tokenId;
            tail = tokenId;
        } else {
            _nextToken[tail] = tokenId;
            tail = tokenId;
        }
        _nextToken[tokenId] = 0;
        unchecked {
            ++queuedCount;
        }

        emit TokenEnqueued(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function queuedLength() external view override returns (uint256) {
        return queuedCount;
    }

    function nextTokenId(uint256 tokenId) external view override returns (uint256) {
        require(tokenId != 0, "NFTReserve: zero token");
        return _nextToken[tokenId];
    }

    function getQueuedTokenIds() external view override returns (uint256[] memory orderedIds) {
        uint256 n = queuedCount;
        orderedIds = new uint256[](n);
        uint256 cur = head;
        for (uint256 i = 0; i < n; ++i) {
            orderedIds[i] = cur;
            cur = _nextToken[cur];
        }
        require(cur == 0, "NFTReserve: queue corrupt");
    }

    /// @notice Remove `tokenId` (predecessor `prev`, `prev == 0` if head) and insert it immediately after `insertAfter`.
    /// @dev    `insertAfter == 0` means prepend as the new head. All pointer updates are O(1).
    function splice(uint256 tokenId, uint256 prev, uint256 insertAfter) external override onlyAuction {
        require(_nextToken[prev] == tokenId || tokenId == head, "NFTReserve: bad prev");
        require(tokenId != insertAfter, "NFTReserve: bad insertAfter");
        require(tail != head, "NFTReserve: cannot splice single item queue");
        require(insertAfter != prev, "NFTReserve: noop splice");

        uint256 succ = _nextToken[tokenId];

        // detach `tokenId` from the queue.
        if (prev == 0) {
            require(head == tokenId, "NFTReserve: bad prev");
            head = succ;
        } else {
            require(_nextToken[prev] == tokenId, "NFTReserve: bad prev");
            _nextToken[prev] = succ;
        }
        // update `tail` if `tokenId` was the tail.
        if (tail == tokenId) tail = prev;

        // insert `tokenId` after `insertAfter`.
        if (insertAfter == 0) {
            _nextToken[tokenId] = head;
            head = tokenId;
        }
        else {
            _nextToken[tokenId] = _nextToken[insertAfter];
            _nextToken[insertAfter] = tokenId;
        }
        if (_nextToken[tokenId] == 0) tail = tokenId;

        emit QueueSpliced(tokenId, prev, insertAfter);
    }

    function popHead() external override onlyAuction returns (uint256 tokenId) {
        return _popHead();
    }

    function _popHead() internal returns (uint256 tokenId) {
        require(head != 0, "NFTReserve: empty queue");
        tokenId = head;
        uint256 nextHead = _nextToken[tokenId];

        delete _nextToken[tokenId];
        head = nextHead;
        if (head == 0) {
            tail = 0;
        }
        unchecked {
            --queuedCount;
        }

        emit QueuePopped(tokenId);
    }

    function pop(uint256 tokenId, uint256 prev) external override onlyAuction returns (uint256 poppedId) {
        if (prev == 0 && tokenId == head) {
            return _popHead();
        }
        require(_nextToken[prev] == tokenId, "NFTReserve: bad prev");
        uint256 succ = _nextToken[tokenId];
        _nextToken[prev] = succ;
        if (succ == 0) tail = prev;
        delete _nextToken[tokenId];
        unchecked {
            --queuedCount;
        }
        emit QueuePopped(tokenId);
        return tokenId;
    }
}
