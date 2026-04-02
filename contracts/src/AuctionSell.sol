// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title AuctionSell
/// @notice Nouns-style highest-bidder auction for Warplets. Bids in an ERC20 `bidToken`.
/// @dev Adapted from NounsAuctionHouse / Zora AuctionHouse (see DegenDogs mission3 branch).
///      NFTs are received via safeTransfer into a FIFO main queue; a LIFO priority stack is drained first
///      when starting each auction. Queue bump (`QUEUE_BUMP_FEE` + `userData`) removes a token from the
///      main queue (swap with tail + pop) and pushes it onto the priority stack. Bump uses caller-supplied
///      `queueIndex` into `_nftQueue` (verified in O(1); clients must compute it off-chain from `queueHead` + reads).
///      On settle, the Warplet NFT is transferred to the winner, bid proceeds to `proceedsRecipient`,
///      and an empty-URI GobbledWarplet receipt is minted to the winner (admin sets URI separately).
/// @dev ERC777 `send` / `tokensReceived`: use empty or non-bump `userData` to bid. To bump, `send` exactly
///      `QUEUE_BUMP_FEE` with `userData = abi.encode(uint256 tokenId, uint256 queueIndex)` (64 bytes).
///      `queueIndex` is the token's current index in `_nftQueue` (see `queueHead` + `mainQueueAt`). Stale
///      indices revert. Other payment amounts use the bid path.

import {IAuctionSell} from "./interfaces/IAuctionSell.sol";
import {IGobbledWarplets} from "./interfaces/IGobbledWarplets.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface IERC777Recipient {
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external;
}

contract AuctionSell is Ownable, Pausable, ReentrancyGuard, IAuctionSell, IERC721Receiver, IERC777Recipient {
    struct Auction {
        uint256 tokenId;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        address payable bidder;
        bool settled;
    }

    IERC721 public immutable nft;
    IERC20 public immutable bidToken;
    IGobbledWarplets public immutable gobbledWarplets;

    address public proceedsRecipient;

    uint256 public timeBuffer;
    uint256 public reservePrice;
    uint8 public minBidIncrementPercentage;
    uint256 public duration;

    Auction public auction;

    uint256[] private _nftQueue;
    uint256 private _queueHead;

    /// @dev LIFO stack: last pushed is the next token after the current auction (ahead of main FIFO tail).
    uint256[] private _priorityQueue;

    /// @notice WARPGOBB required to move a queued Warplet to the head via ERC777 `send` + `userData`.
    uint256 public constant QUEUE_BUMP_FEE = 1_000_000 * 1e18;

    event AuctionExtended(uint256 indexed tokenId, uint256 endTime);
    event AuctionTimeBufferUpdated(uint256 timeBuffer);
    event AuctionReservePriceUpdated(uint256 reservePrice);
    event AuctionMinBidIncrementPercentageUpdated(uint8 minBidIncrementPercentage);
    event ProceedsRecipientUpdated(address indexed recipient);
    event QueueBumped(address indexed payer, uint256 indexed tokenId, uint256 fee);

    constructor(
        IERC721 _nft,
        IERC20 _bidToken,
        IGobbledWarplets _gobbledWarplets,
        address _proceedsRecipient,
        uint256 _timeBuffer,
        uint256 _reservePrice,
        uint8 _minBidIncrementPercentage,
        uint256 _duration,
        address initialOwner
    ) Ownable(initialOwner) {
        require(address(_nft) != address(0) && address(_bidToken) != address(0), "AuctionSell: zero token");
        require(address(_gobbledWarplets) != address(0), "AuctionSell: zero gobbled");
        require(_proceedsRecipient != address(0), "AuctionSell: zero proceeds");
        nft = _nft;
        bidToken = _bidToken;
        gobbledWarplets = _gobbledWarplets;
        proceedsRecipient = _proceedsRecipient;
        timeBuffer = _timeBuffer;
        reservePrice = _reservePrice;
        minBidIncrementPercentage = _minBidIncrementPercentage;
        duration = _duration;
        _pause();
        // Register this contract as an ERC1820 implementer for the ERC777TokensRecipient interface
        // (i.e., ERC1820: "ERC777TokensRecipient" = keccak256("ERC777TokensRecipient"))
        // Allows contract to safely receive ERC777 tokens

        address _ERC1820_REGISTRY = 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;
        bytes32 _TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

        // solhint-disable-next-line avoid-low-level-calls
        (bool ok, ) = _ERC1820_REGISTRY.call(
            abi.encodeWithSignature(
                "setInterfaceImplementer(address,bytes32,address)",
                address(this),
                _TOKENS_RECIPIENT_INTERFACE_HASH,
                address(this)
            )
        );
        require(ok, "AuctionSell: ERC1820 registration failed");
    }

    /// @inheritdoc IERC721Receiver
    function onERC721Received(address, address, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        require(msg.sender == address(nft), "AuctionSell: only configured NFT");
        _nftQueue.push(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function queuedLength() external view returns (uint256) {
        return (_nftQueue.length - _queueHead) + _priorityQueue.length;
    }

    function priorityQueueLength() external view returns (uint256) {
        return _priorityQueue.length;
    }

    function nextQueuedTokenId() external view returns (uint256) {
        if (_priorityQueue.length > 0) {
            return _priorityQueue[_priorityQueue.length - 1];
        }
        require(_nftQueue.length > _queueHead, "AuctionSell: empty queue");
        return _nftQueue[_queueHead];
    }

    /// @notice First valid index in `_nftQueue` for the live main tail (bump `queueIndex` must be >= this).
    function queueHead() external view returns (uint256) {
        return _queueHead;
    }

    /// @notice TokenId stored at `_nftQueue[index]` (any index < length); use with `queueHead` for bump encoding.
    function mainQueueAt(uint256 index) external view returns (uint256 tokenId) {
        require(index < _nftQueue.length, "AuctionSell: queue index OOB");
        return _nftQueue[index];
    }

    /// @inheritdoc IAuctionSell
    function bid(uint256 amount) external override nonReentrant whenNotPaused {
        require(bidToken.transferFrom(msg.sender, address(this), amount), "AuctionSell: pull failed");
        _bid(amount, msg.sender);
    }

    function tokensReceived(
        address /*operator*/,
        address from,
        address /*to*/,
        uint256 amount,
        bytes calldata userData,
        bytes calldata /*operatorData*/
    ) external override nonReentrant whenNotPaused {
        require(msg.sender == address(bidToken), "AuctionSell: only configured token");
        if (amount == QUEUE_BUMP_FEE && userData.length == 64) {
            (uint256 tokenId, uint256 queueIndex) = abi.decode(userData, (uint256, uint256));
            _bumpQueueToHead(from, tokenId, queueIndex, amount);
            return;
        }
        _bid(amount, from);
    }
    
    function _bid(uint256 amount, address from) internal {
        Auction memory _auction = auction;

        require(_auction.startTime != 0, "AuctionSell: no auction");
        require(!_auction.settled, "AuctionSell: settled");
        require(block.timestamp < _auction.endTime, "AuctionSell: expired");
        require(amount >= reservePrice, "AuctionSell: below reserve");

        if (_auction.amount > 0) {
            require(
                amount >= _auction.amount + ((_auction.amount * minBidIncrementPercentage) / 100),
                "AuctionSell: bid too low"
            );
        }

        address payable lastBidder = _auction.bidder;
        uint256 lastAmount = _auction.amount;

        
        auction.amount = amount;
        auction.bidder = payable(from);
        
        if (lastBidder != address(0)) {
            require(bidToken.transfer(lastBidder, lastAmount), "AuctionSell: refund failed");
        }

        bool extended = _auction.endTime - block.timestamp < timeBuffer;
        if (extended) {
            auction.endTime = block.timestamp + timeBuffer;
        }

        emit BidPlaced(_auction.tokenId, from, amount);

        if (extended) {
            emit AuctionExtended(_auction.tokenId, auction.endTime);
        }
    }

    /// @dev Removes `tokenId` at `queueIndex` from the main queue (swap with tail + pop), pushes onto LIFO priority stack.
    function _bumpQueueToHead(address payer, uint256 tokenId, uint256 queueIndex, uint256 fee) internal {
        require(nft.ownerOf(tokenId) == address(this), "AuctionSell: not holding NFT");
        require(
            queueIndex >= _queueHead && queueIndex < _nftQueue.length && _nftQueue[queueIndex] == tokenId,
            "AuctionSell: bad queue index"
        );

        uint256 lastIdx = _nftQueue.length - 1;
        if (queueIndex != lastIdx) {
            _nftQueue[queueIndex] = _nftQueue[lastIdx];
        }
        _nftQueue.pop();

        _priorityQueue.push(tokenId);

        require(bidToken.transfer(proceedsRecipient, fee), "AuctionSell: bump proceeds failed");
        emit QueueBumped(payer, tokenId, fee);
    }

    function _hasPendingTokens() internal view returns (bool) {
        return _priorityQueue.length > 0 || _nftQueue.length > _queueHead;
    }

    function _peekNextTokenId() internal view returns (uint256) {
        if (_priorityQueue.length > 0) {
            return _priorityQueue[_priorityQueue.length - 1];
        }
        require(_nftQueue.length > _queueHead, "AuctionSell: empty queue");
        return _nftQueue[_queueHead];
    }

    /// @inheritdoc IAuctionSell
    function settle() external override nonReentrant whenPaused {
        _settleAuction();
    }

    /// @inheritdoc IAuctionSell
    function settleCurrentAndCreateNewAuction() external override nonReentrant whenNotPaused {
        _settleAuction();
        if (_hasPendingTokens()) {
            _startAuctionFromQueueHead();
        }
    }

    /// @inheritdoc IAuctionSell
    function startAuction(uint256 tokenId) external override nonReentrant whenNotPaused {
        require(auction.startTime == 0 || auction.settled, "AuctionSell: auction live");
        require(tokenId == _peekNextTokenId(), "AuctionSell: not next in queue");
        _startAuctionFromQueueHead();
    }

    /// @inheritdoc IAuctionSell
    function currentAuction()
        external
        view
        override
        returns (uint256 tokenId, address highBidder, uint256 highBid, uint256 endTime)
    {
        if (auction.startTime == 0 || auction.settled) {
            return (0, address(0), 0, 0);
        }
        return (auction.tokenId, auction.bidder, auction.amount, auction.endTime);
    }

    function extendAuction() external nonReentrant whenNotPaused {
        Auction memory _auction = auction;

        require(_auction.amount == 0, "AuctionSell: has bids");
        require(block.timestamp >= _auction.endTime, "AuctionSell: still live");
        require(_auction.startTime != 0 && !_auction.settled, "AuctionSell: no auction");

        auction.endTime = block.timestamp + duration;

        emit AuctionExtended(_auction.tokenId, auction.endTime);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner nonReentrant {
        _unpause();

        if (auction.startTime == 0 || auction.settled) {
            if (_hasPendingTokens()) {
                _startAuctionFromQueueHead();
            }
        }
    }

    function setTimeBuffer(uint256 _timeBuffer) external onlyOwner {
        timeBuffer = _timeBuffer;
        emit AuctionTimeBufferUpdated(_timeBuffer);
    }

    function setReservePrice(uint256 _reservePrice) external onlyOwner {
        reservePrice = _reservePrice;
        emit AuctionReservePriceUpdated(_reservePrice);
    }

    function setMinBidIncrementPercentage(uint8 _minBidIncrementPercentage) external onlyOwner {
        minBidIncrementPercentage = _minBidIncrementPercentage;
        emit AuctionMinBidIncrementPercentageUpdated(_minBidIncrementPercentage);
    }

    function setProceedsRecipient(address _proceedsRecipient) external onlyOwner {
        require(_proceedsRecipient != address(0), "AuctionSell: zero proceeds");
        proceedsRecipient = _proceedsRecipient;
        emit ProceedsRecipientUpdated(_proceedsRecipient);
    }

    /// @notice Move live queue entries to the front of `_nftQueue` and shrink storage length (clears skipped head slots).
    /// @dev Rare maintenance hook if `_queueHead` grows large vs `length`. FIFO order is preserved. No-op if `_queueHead == 0`.
    function compactQueue() external onlyOwner {
        uint256 head = _queueHead;
        uint256 len = _nftQueue.length;

        if (len == 0) {
            _queueHead = 0;
            return;
        }
        if (head == 0) {
            return;
        }
        if (head >= len) {
            while (_nftQueue.length > 0) {
                _nftQueue.pop();
            }
            _queueHead = 0;
            return;
        }

        uint256 tail = len - head;
        for (uint256 i = 0; i < tail; i++) {
            _nftQueue[i] = _nftQueue[head + i];
        }
        while (_nftQueue.length > tail) {
            _nftQueue.pop();
        }
        _queueHead = 0;
    }

    function _startAuctionFromQueueHead() internal {
        uint256 tokenId;
        if (_priorityQueue.length > 0) {
            tokenId = _priorityQueue[_priorityQueue.length - 1];
            _priorityQueue.pop();
        } else {
            require(_nftQueue.length > _queueHead, "AuctionSell: empty queue");
            tokenId = _nftQueue[_queueHead];
            ++_queueHead;
            delete _nftQueue[_queueHead - 1];
        }

        require(nft.ownerOf(tokenId) == address(this), "AuctionSell: not holding NFT");

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        auction = Auction({
            tokenId: tokenId,
            amount: 0,
            startTime: startTime,
            endTime: endTime,
            bidder: payable(address(0)),
            settled: false
        });

        emit AuctionStarted(tokenId, endTime);
    }

    function _settleAuction() internal {
        Auction memory _auction = auction;

        require(_auction.amount > 0, "AuctionSell: needs bids");
        require(_auction.startTime != 0, "AuctionSell: not begun");
        require(!_auction.settled, "AuctionSell: already settled");
        require(block.timestamp >= _auction.endTime, "AuctionSell: not complete");

        auction.settled = true;

        uint256 gobbledTokenId = gobbledWarplets.mint(_auction.bidder, _auction.tokenId);

        nft.transferFrom(address(this), _auction.bidder, _auction.tokenId);

        require(bidToken.transfer(proceedsRecipient, _auction.amount), "AuctionSell: proceeds failed");

        emit AuctionSettled(_auction.tokenId, _auction.bidder, _auction.amount, gobbledTokenId);
    }
}
