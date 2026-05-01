// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title AuctionSell
/// @notice Nouns-style highest-bidder auction for Warplets. Bids in an ERC20 `bidToken`.
/// @dev Adapted from NounsAuctionHouse / Zora AuctionHouse (see DegenDogs mission3 branch).
///      Warplet NFTs are received directly by the configured reserve (`GobbledWarplets.nftReserve()`),
///      which owns custody + queue state; this contract does not implement `IERC721Receiver`.
///      Queue bump (`queueBumpFee` + `userData`) still uses caller-supplied `prev`; this contract forwards the
///      move to reserve and preserves the existing external bump UX.
///      On settle, bid proceeds go to `proceedsRecipient` and reserve books the GobbledWarplets
///      receipt id for the winner.
/// @dev ERC777 `send` / `tokensReceived`: use empty or non-bump `userData` to bid. To bump, `send` exactly
///      `queueBumpFee` with `userData = abi.encode(uint256 tokenId, uint256 prev)` (64 bytes). If `tokenId`
///      is already at the queue head, bump reverts. Stale `prev` reverts in reserve. Other payment
///      amounts use the bid path.

import {IAuctionSell} from "./interfaces/IAuctionSell.sol";
import {IGobbledWarplets} from "./interfaces/IGobbledWarplets.sol";
import {INFTReserve} from "./interfaces/INFTReserve.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
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

interface IGobbledWarpletsWithReserve {
    function nftReserve() external view returns (address);
}

contract AuctionSell is Ownable, Pausable, ReentrancyGuard, IAuctionSell, IERC777Recipient {
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
    INFTReserve public immutable nftReserve;

    /// @notice Streme zap used when `bid` is called with `msg.value > 0`. May be `address(0)` if only ERC20 pulls are used.
    address public immutable stremeZap;

    address public proceedsRecipient;

    uint256 public timeBuffer;
    uint256 public reservePrice;
    uint8 public minBidIncrementPercentage;
    uint256 public duration;

    Auction public auction;

    /// @notice WARPGOBB required to move a queued Warplet to the head via ERC777 `send` + `userData`.
    uint256 public queueBumpFee;

    event AuctionExtended(uint256 indexed tokenId, uint256 endTime);
    event AuctionTimeBufferUpdated(uint256 timeBuffer);
    event AuctionReservePriceUpdated(uint256 reservePrice);
    event AuctionMinBidIncrementPercentageUpdated(uint8 minBidIncrementPercentage);
    event ProceedsRecipientUpdated(address indexed recipient);
    event QueueBumpFeeUpdated(uint256 queueBumpFee);
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
        address reserveAddr = IGobbledWarpletsWithReserve(address(_gobbledWarplets)).nftReserve();
        require(reserveAddr != address(0), "AuctionSell: zero reserve");
        nft = _nft;
        bidToken = _bidToken;
        gobbledWarplets = _gobbledWarplets;
        nftReserve = INFTReserve(reserveAddr);
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
    }

    function queuedLength() external view returns (uint256) {
        return nftReserve.queuedLength() - (_isAuctionLive() ? 1 : 0);
    }

    /// @notice Full reserve queue order from head to tail for off-chain / frontend use. O(n) gas.
    function getQueuedTokenIds() external view returns (uint256[] memory orderedIds) {
        return nftReserve.getQueuedTokenIds();
    }

    function nextQueuedTokenId() external view returns (uint256) {
        require(_hasPendingTokens(), "AuctionSell: empty queue");
        return _peekNextTokenId();
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
            require(bidToken.transferFrom(msg.sender, address(this), amount), "AuctionSell: pull for bid failed");
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

    function bump(uint256 tokenId, uint256 prev) external nonReentrant whenNotPaused {
        require(bidToken.transferFrom(msg.sender, address(this), queueBumpFee), "AuctionSell: pull for bump failed");
        _bumpToFront(msg.sender, tokenId, prev, queueBumpFee);
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

    /// @dev Splice `tokenId` out (`prev`) into the pending front: after the queue head if an auction is live, else prepend as the new head (`insertAfter` 0).
    function _bumpToFront(address payer, uint256 tokenId, uint256 prev, uint256 fee) internal {
        require(tokenId != _peekNextTokenId(), "AuctionSell: already first");
        require(nftReserve.nextTokenId(prev) == tokenId, "AuctionSell: bad prev");
        nftReserve.splice(tokenId, prev, _isAuctionLive() ? nftReserve.head() : 0);

        require(bidToken.transfer(proceedsRecipient, fee), "AuctionSell: bump proceeds failed");
        emit QueueBumped(payer, tokenId, fee);
    }

    function _hasPendingTokens() internal view returns (bool) {
        return nftReserve.queuedLength() > (_isAuctionLive() ? 1 : 0);
    }

    function _peekNextTokenId() internal view returns (uint256) {
        require(_hasPendingTokens(), "AuctionSell: empty queue");
        uint256 head = nftReserve.head();
        return _isAuctionLive() ? nftReserve.nextTokenId(head) : head;
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

    function setQueueBumpFee(uint256 _queueBumpFee) external onlyOwner {
        queueBumpFee = _queueBumpFee;
        emit QueueBumpFeeUpdated(_queueBumpFee);
    }

    function _startAuctionFromQueueHead() internal {
        INFTReserve reserve = nftReserve;
        uint256 tokenId = reserve.head();
        require(tokenId != 0, "AuctionSell: empty queue");

        require(nft.ownerOf(tokenId) == address(reserve), "AuctionSell: not held in reserve");

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

        uint256 gobbledTokenId = gobbledWarplets.createReceipt(_auction.bidder, _auction.tokenId);
        uint256 popped = nftReserve.pop(_auction.tokenId, 0);
        require(popped == _auction.tokenId, "AuctionSell: bad pop");

        require(bidToken.transfer(proceedsRecipient, _auction.amount), "AuctionSell: proceeds failed");

        emit AuctionSettled(_auction.tokenId, _auction.bidder, _auction.amount, gobbledTokenId);
    }

    function _isAuctionLive() internal view returns (bool) {
        return auction.startTime != 0 && !auction.settled;
    }
}
