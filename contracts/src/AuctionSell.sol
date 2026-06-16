// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title AuctionSell
/// @notice Nouns-style highest-bidder auction for Warplets. Bids in an ERC20 `bidToken`.
/// @dev Adapted from NounsAuctionHouse / Zora AuctionHouse (see DegenDogs mission3 branch).
///      NFTs are received via safeTransfer into a singly-linked FIFO queue (`_listHead` … `_nextToken`).
///      Queue bump (`queueBumpFee` + `userData`) splices a token out using caller-supplied `prev` (the token id
///      immediately before it in queue order) and prepends it to the head. On settle, bid proceeds go to
///      `proceedsRecipient` and a GobbledWarplets receipt id is reserved for the winner; the underlying
///      Warplet NFT stays in this contract until the winner pulls it via `GobbledWarplets.rescueWarplet`,
///      which calls `IERC721.transferFrom(this, winner, warpletId)` directly — authorized by the
///      one-shot `setApprovalForAll(gobbledWarplets, true)` granted in this contract's constructor.
/// @dev ERC777 `send` / `tokensReceived`: use empty or non-bump `userData` to bid. To bump, `send` exactly
///      `queueBumpFee` with `userData = abi.encode(uint256 tokenId, uint256 prev)` (64 bytes). `prev` must
///      satisfy `_nextToken[prev] == tokenId` (walk `getQueuedTokenIds()` off-chain to compute). If `tokenId`
///      is already at the queue head, bump reverts. Stale `prev` reverts. Other payment amounts use the bid path.
/// @dev **Token id 0:** the queue uses `0` as the “no next” / empty-head sentinel. The Warplets collection
///      does not assign token id `0`; this contract is only intended for that collection as `nft`. Pointing
///      `nft` at an ERC-721 that can mint id `0` would collide with that sentinel and break queue invariants.

import {IAuctionSell} from "./interfaces/IAuctionSell.sol";
import {IGobbledWarplets} from "./interfaces/IGobbledWarplets.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @dev Streme `StremeZapUniversal` exposes this swap as the external function `zap` (same name on the ABI;
///      do not confuse with internal/helper naming elsewhere in Streme source).
///      `stakingContract == address(0)` sends output to `msg.sender` and skips `stake`; any non-zero address is
///      treated as a staking target and the zap may call `stake` there — never pass `address(this)` from FeeHandler.
interface IStremeZapUniversal {
    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract)
        external
        payable
        returns (uint256 amountOut);
}

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

    /// @notice Streme zap used when `bid` is called with `msg.value > 0`. May be `address(0)` if only ERC20 pulls are used.
    address public immutable stremeZap;

    address public proceedsRecipient;

    uint256 public timeBuffer;
    uint256 public reservePrice;
    uint8 public minBidIncrementPercentage;
    uint256 public duration;

    Auction public auction;

    /// @dev Head of the waiting queue (next token to auction after the current one settles). `0` = empty
    ///      (valid only because Warplets never use token id 0 — see contract @dev above).
    uint256 private _listHead;
    uint256 private _listTail;
    mapping(uint256 tokenId => uint256 nextTokenId) private _nextToken;
    uint256 private _queuedCount;

    /// @notice WARPGOBB required to move a queued Warplet to the head via ERC777 `send` + `userData`.
    uint256 public queueBumpFee;

    event AuctionExtended(uint256 indexed tokenId, uint256 endTime);
    event AuctionTimeBufferUpdated(uint256 timeBuffer);
    event AuctionDurationUpdated(uint256 duration);
    event AuctionReservePriceUpdated(uint256 reservePrice);
    event AuctionMinBidIncrementPercentageUpdated(uint8 minBidIncrementPercentage);
    event ProceedsRecipientUpdated(address indexed recipient);
    event QueueBumpFeeUpdated(uint256 queueBumpFee);
    event TokenEnqueued(uint256 indexed tokenId);
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
        address initialOwner,
        address _stremeZap
    ) Ownable(initialOwner) {
        require(address(_nft) != address(0) && address(_bidToken) != address(0), "AuctionSell: zero token");
        require(address(_gobbledWarplets) != address(0), "AuctionSell: zero gobbled");
        require(_proceedsRecipient != address(0), "AuctionSell: zero proceeds");
        nft = _nft;
        bidToken = _bidToken;
        gobbledWarplets = _gobbledWarplets;
        stremeZap = _stremeZap;
        proceedsRecipient = _proceedsRecipient;
        timeBuffer = _timeBuffer;
        reservePrice = _reservePrice;
        minBidIncrementPercentage = _minBidIncrementPercentage;
        duration = _duration;
        queueBumpFee = 1_000_000 * 1e18;
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

        // Allow `gobbledWarplets` to pull won Warplets directly via `transferFrom` once a winner calls
        // `GobbledWarplets.rescueWarplet`. Settlement no longer transfers the underlying NFT; this
        // approval is the only path out of the auction for held Warplets.
        _nft.setApprovalForAll(address(_gobbledWarplets), true);
    }

    /// @inheritdoc IERC721Receiver
    function onERC721Received(address, address, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        require(msg.sender == address(nft), "AuctionSell: only configured NFT");
        if (_listHead == 0) {
            _listHead = tokenId;
            _listTail = tokenId;
            _nextToken[tokenId] = 0;
        } else {
            _nextToken[_listTail] = tokenId;
            _listTail = tokenId;
            _nextToken[tokenId] = 0;
        }
        unchecked {
            ++_queuedCount;
        }
        emit TokenEnqueued(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function queuedLength() external view returns (uint256) {
        return _queuedCount;
    }

    /// @notice Full waiting-queue order from head to tail for off-chain / frontend use. O(n) gas.
    function getQueuedTokenIds() external view returns (uint256[] memory orderedIds) {
        uint256 n = _queuedCount;
        orderedIds = new uint256[](n);
        uint256 cur = _listHead;
        for (uint256 i = 0; i < n; ++i) {
            orderedIds[i] = cur;
            cur = _nextToken[cur];
        }
        require(cur == 0, "AuctionSell: queue corrupt");
    }

    function nextQueuedTokenId() external view returns (uint256) {
        require(_listHead != 0, "AuctionSell: empty queue");
        return _listHead;
    }

    /// @inheritdoc IAuctionSell
    function bid(uint256 amount) external payable override nonReentrant whenNotPaused {
        if (msg.value > 0) {
            require(stremeZap != address(0), "AuctionSell: zap unset");
            // Same `zap` semantics as `FeeHandler._swapWethToToken`: `stremeCoin` is the **out** token,
            // `amountIn` is how much **native / wrapper input** is spent (`FeeHandler` passes WETH balance;
            // here we pass ETH via `msg.value`, so the input size is `msg.value`), `amountOutMin` is the
            // caller’s minimum **out** (the bid size / slippage floor). `stakingContract == address(0)` sends
            // proceeds to `msg.sender` (this contract).
            //
            // SECURITY: ignore the zap's return value and measure our own balance delta. A misbehaving
            // zap that over-reports `amountOut` would otherwise pass the slippage check on a partial
            // delivery, leaving the auction with less bidToken than the recorded bid — bricking
            // settlement (the auction would be unable to pay `proceedsRecipient`). Same balance-delta
            // pattern as `FeeHandler._swapWethToToken`.
            uint256 balanceBefore = bidToken.balanceOf(address(this));
            IStremeZapUniversal(stremeZap).zap{value: msg.value}(
                address(bidToken),
                msg.value,
                uint256(amount),
                address(0)
            );
            uint256 amountOut = bidToken.balanceOf(address(this)) - balanceBefore;
            require(amountOut >= amount, "AuctionSell: zap slippage");
            _bid(amount, msg.sender);
            if (amountOut > amount) {
                require(bidToken.transfer(msg.sender, amountOut - amount), "AuctionSell: refund failed");
            }
        } else {
            require(bidToken.transferFrom(msg.sender, address(this), amount), "AuctionSell: pull failed");
            _bid(amount, msg.sender);
        }
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
        if (amount == queueBumpFee && userData.length == 64) {
            (uint256 tokenId, uint256 prev) = abi.decode(userData, (uint256, uint256));
            _bumpToFront(from, tokenId, prev, amount);
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

    /// @dev Splice `tokenId` out (predecessor `prev`) and prepend to `_listHead`.
    function _bumpToFront(address payer, uint256 tokenId, uint256 prev, uint256 fee) internal {
        require(nft.ownerOf(tokenId) == address(this), "AuctionSell: not holding NFT");
        require(_listHead != 0, "AuctionSell: empty queue");
        require(tokenId != _listHead, "AuctionSell: already first");
        require(_nextToken[prev] == tokenId, "AuctionSell: bad prev");

        uint256 oldNext = _nextToken[tokenId];
        _nextToken[prev] = oldNext;
        if (_listTail == tokenId) {
            _listTail = prev;
        }

        _nextToken[tokenId] = _listHead;
        _listHead = tokenId;

        require(bidToken.transfer(proceedsRecipient, fee), "AuctionSell: bump proceeds failed");
        emit QueueBumped(payer, tokenId, fee);
    }

    function _hasPendingTokens() internal view returns (bool) {
        return _listHead != 0;
    }

    function _peekNextTokenId() internal view returns (uint256) {
        require(_listHead != 0, "AuctionSell: empty queue");
        return _listHead;
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

    function setDuration(uint256 _duration) external onlyOwner {
        require(_duration > 0, "AuctionSell: zero duration");
        duration = _duration;
        emit AuctionDurationUpdated(_duration);
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

    function setQueueBumpFee(uint256 _queueBumpFee) external onlyOwner {
        queueBumpFee = _queueBumpFee;
        emit QueueBumpFeeUpdated(_queueBumpFee);
    }

    function _startAuctionFromQueueHead() internal {
        require(_listHead != 0, "AuctionSell: empty queue");
        uint256 tokenId = _listHead;
        uint256 nextHead = _nextToken[tokenId];
        delete _nextToken[tokenId];
        _listHead = nextHead;
        if (_listHead == 0) {
            _listTail = 0;
        }
        unchecked {
            --_queuedCount;
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

        uint256 gobbledTokenId = gobbledWarplets.reserve(_auction.bidder, _auction.tokenId);

        require(bidToken.transfer(proceedsRecipient, _auction.amount), "AuctionSell: proceeds failed");

        emit AuctionSettled(_auction.tokenId, _auction.bidder, _auction.amount, gobbledTokenId);
    }
}
