// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {MockBidToken} from "./mocks/MockBidToken.sol";
import {MockAuctionNFT} from "./mocks/MockAuctionNFT.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AuctionSellTest is Test {
    AuctionSell internal sell;
    GobbledWarplets internal gobbled;
    MockAuctionNFT internal nft;
    MockBidToken internal bidToken;

    address internal owner = makeAddr("owner");
    address internal proceeds = makeAddr("proceeds");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant DURATION = 24 hours;
    uint256 internal constant TIME_BUFFER = 5 minutes;
    uint256 internal constant RESERVE_PRICE = 10_000_000 * 1e18;
    uint8 internal constant MIN_INCREMENT_PCT = 10;

    uint256 internal constant BID_TOKEN_SEED = 500_000_000 * 1e18;

    event AuctionExtended(uint256 indexed tokenId, uint256 endTime);
    event AuctionTimeBufferUpdated(uint256 timeBuffer);
    event AuctionReservePriceUpdated(uint256 reservePrice);
    event AuctionMinBidIncrementPercentageUpdated(uint8 minBidIncrementPercentage);
    event ProceedsRecipientUpdated(address indexed recipient);

    function setUp() public {
        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        bidToken = new MockBidToken();
        gobbled = new GobbledWarplets("Gobbled Warplets", "GOBBLED", owner);
        sell = new AuctionSell(
            IERC721(address(nft)),
            bidToken,
            gobbled,
            proceeds,
            TIME_BUFFER,
            RESERVE_PRICE,
            MIN_INCREMENT_PCT,
            DURATION,
            owner
        );
        gobbled.setMinter(address(sell));
        vm.stopPrank();

        bidToken.mint(alice, BID_TOKEN_SEED);
        bidToken.mint(bob, BID_TOKEN_SEED);
        bidToken.mint(carol, BID_TOKEN_SEED);

        vm.prank(alice);
        bidToken.approve(address(sell), type(uint256).max);
        vm.prank(bob);
        bidToken.approve(address(sell), type(uint256).max);
        vm.prank(carol);
        bidToken.approve(address(sell), type(uint256).max);
    }

    function _mintAndSendToSell(address from) internal returns (uint256 tokenId) {
        vm.prank(owner);
        tokenId = nft.mint(from);
        vm.prank(from);
        nft.safeTransferFrom(from, address(sell), tokenId);
    }

    function _unpauseStartsAuction(uint256 tokenId) internal {
        vm.prank(owner);
        sell.unpause();
        (uint256 tid,,, uint256 endTime) = sell.currentAuction();
        assertEq(tid, tokenId);
        assertGt(endTime, block.timestamp);
    }

    /* ========== intake & unpause ========== */

    function test_safeTransfer_queues_nft_and_unpause_starts_auction() public {
        address holder = makeAddr("holder");
        vm.prank(owner);
        uint256 tokenId = nft.mint(holder);

        assertEq(sell.queuedLength(), 0);

        vm.prank(holder);
        nft.safeTransferFrom(holder, address(sell), tokenId);

        assertEq(sell.queuedLength(), 1);
        assertEq(sell.nextQueuedTokenId(), tokenId);

        _unpauseStartsAuction(tokenId);
        assertEq(sell.queuedLength(), 0);
        assertEq(nft.ownerOf(tokenId), address(sell));
    }

    function test_fifo_order_two_nfts() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        assertEq(sell.nextQueuedTokenId(), t1);

        vm.prank(owner);
        sell.unpause();
        (uint256 activeId,,,) = sell.currentAuction();
        assertEq(activeId, t1);

        bidToken.mint(owner, RESERVE_PRICE);
        vm.prank(owner);
        bidToken.approve(address(sell), type(uint256).max);
        vm.prank(owner);
        sell.bid(RESERVE_PRICE);

        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        (uint256 tid,,,) = sell.currentAuction();
        assertEq(tid, t2);
    }

    /* ========== bidding & refunds ========== */

    function test_bid_below_reserve_reverts() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        vm.prank(alice);
        vm.expectRevert(bytes("AuctionSell: below reserve"));
        sell.bid(RESERVE_PRICE - 1);
    }

    function test_multiple_bidders_losing_bids_refunded() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 aliceStart = bidToken.balanceOf(alice);
        uint256 bobStart = bidToken.balanceOf(bob);
        uint256 carolStart = bidToken.balanceOf(carol);

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        assertEq(bidToken.balanceOf(alice), aliceStart - RESERVE_PRICE);
        assertEq(bidToken.balanceOf(address(sell)), RESERVE_PRICE);

        uint256 bobBid = RESERVE_PRICE + (RESERVE_PRICE * MIN_INCREMENT_PCT) / 100;
        vm.prank(bob);
        sell.bid(bobBid);

        assertEq(bidToken.balanceOf(alice), aliceStart);
        assertEq(bidToken.balanceOf(bob), bobStart - bobBid);
        assertEq(bidToken.balanceOf(address(sell)), bobBid);

        uint256 carolBid = bobBid + (bobBid * MIN_INCREMENT_PCT) / 100;
        vm.prank(carol);
        sell.bid(carolBid);

        assertEq(bidToken.balanceOf(bob), bobStart);
        assertEq(bidToken.balanceOf(carol), carolStart - carolBid);
        assertEq(bidToken.balanceOf(address(sell)), carolBid);

        (, address highBidder, uint256 highBid,) = sell.currentAuction();
        assertEq(highBidder, carol);
        assertEq(highBid, carolBid);
    }

    function test_bid_too_low_after_first_bid_reverts() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);

        uint256 minSecond = RESERVE_PRICE + (RESERVE_PRICE * MIN_INCREMENT_PCT) / 100;
        vm.prank(bob);
        vm.expectRevert(bytes("AuctionSell: bid too low"));
        sell.bid(minSecond - 1);
    }

    function test_bid_when_paused_reverts() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        vm.prank(owner);
        sell.pause();

        vm.prank(alice);
        vm.expectPartialRevert(Pausable.EnforcedPause.selector);
        sell.bid(RESERVE_PRICE);
    }

    /* ========== time buffer extension ========== */

    function test_bid_inside_time_buffer_extends_end_time() public {
        uint256 tid = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        (, ,, uint256 endBefore) = sell.currentAuction();
        uint256 warpTo = endBefore - 3 minutes;
        vm.warp(warpTo);

        vm.expectEmit(true, false, false, true, address(sell));
        emit AuctionExtended(tid, warpTo + TIME_BUFFER);

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);

        (, ,, uint256 endAfter) = sell.currentAuction();
        assertEq(endAfter, warpTo + TIME_BUFFER);
    }

    /* ========== settleCurrentAndCreateNewAuction ========== */

    function test_settleCurrent_transfers_nft_and_proceeds_starts_next() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);

        vm.prank(owner);
        sell.unpause();

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);

        vm.warp(block.timestamp + DURATION + 1);

        uint256 proceedsBefore = bidToken.balanceOf(proceeds);
        sell.settleCurrentAndCreateNewAuction();

        assertEq(nft.ownerOf(t1), alice);
        assertEq(bidToken.balanceOf(proceeds), proceedsBefore + RESERVE_PRICE);
        assertEq(gobbled.ownerOf(t1), alice);
        assertEq(gobbled.warpletOf(t1), t1);
        assertEq(gobbled.gobbleIndexOf(t1), 0);
        assertEq(gobbled.totalSupply(), 1);
        assertEq(gobbled.tokenOfOwnerByIndex(alice, 0), t1);
        assertEq(gobbled.tokenByIndex(0), t1);
        assertTrue(gobbled.supportsInterface(type(IERC721Enumerable).interfaceId));

        (uint256 nextId,,,) = sell.currentAuction();
        assertEq(nextId, t2);
    }

    function test_settle_mints_gobbled_receipt_incrementing_gobble_index() public {
        uint256 wid = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        assertEq(gobbled.ownerOf(wid), alice);
        assertEq(nft.ownerOf(wid), alice);

        vm.prank(alice);
        nft.safeTransferFrom(alice, address(sell), wid);
        sell.startAuction(wid);

        vm.prank(bob);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        uint256 stride = gobbled.TOKEN_ID_DECIMAL_STRIDE();
        uint256 secondGobbledId = stride + wid;
        assertEq(gobbled.ownerOf(secondGobbledId), bob);
        assertEq(gobbled.warpletOf(secondGobbledId), wid);
        assertEq(gobbled.gobbleIndexOf(secondGobbledId), 1);
        assertEq(gobbled.totalSupply(), 2);
        assertEq(gobbled.tokenOfOwnerByIndex(alice, 0), wid);
        assertEq(gobbled.tokenOfOwnerByIndex(bob, 0), secondGobbledId);
        assertEq(gobbled.tokenByIndex(0), wid);
        assertEq(gobbled.tokenByIndex(1), secondGobbledId);
    }

    function test_settle_reverts_when_warplet_id_too_large_for_gobbled_encoding() public {
        vm.prank(owner);
        uint256 badId = nft.mintSpecific(owner, gobbled.MAX_WARPLET_ID_EXCLUSIVE());

        vm.prank(owner);
        nft.safeTransferFrom(owner, address(sell), badId);

        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectRevert(bytes("GobbledWarplets: warpletId too large"));
        sell.settleCurrentAndCreateNewAuction();
    }

    function test_settleCurrent_no_next_when_queue_empty() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        sell.settleCurrentAndCreateNewAuction();

        (uint256 id, address bidder, uint256 amt, uint256 end) = sell.currentAuction();
        assertEq(id, 0);
        assertEq(bidder, address(0));
        assertEq(amt, 0);
        assertEq(end, 0);
        (,,,,, bool settled) = sell.auction();
        assertTrue(settled);
    }

    function test_settleCurrent_reverts_if_not_ended() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);

        vm.expectRevert(bytes("AuctionSell: not complete"));
        sell.settleCurrentAndCreateNewAuction();
    }

    function test_settleCurrent_reverts_without_bids() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectRevert(bytes("AuctionSell: needs bids"));
        sell.settleCurrentAndCreateNewAuction();
    }

    /* ========== settle() whenPaused ========== */

    function test_settle_only_when_paused() public {
        uint256 tid = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectPartialRevert(Pausable.ExpectedPause.selector);
        sell.settle();

        vm.prank(owner);
        sell.pause();
        sell.settle();

        assertEq(nft.ownerOf(tid), alice);
        assertEq(bidToken.balanceOf(proceeds), RESERVE_PRICE);
    }

    function test_settle_reverts_when_not_paused() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectPartialRevert(Pausable.ExpectedPause.selector);
        sell.settle();
    }

    /* ========== extendAuction (no bids) ========== */

    function test_extendAuction_no_bids_after_end() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        vm.warp(block.timestamp + DURATION + 1);
        uint256 before = block.timestamp;

        sell.extendAuction();

        (, ,, uint256 end) = sell.currentAuction();
        assertEq(end, before + DURATION);
    }

    function test_extendAuction_reverts_if_has_bids() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectRevert(bytes("AuctionSell: has bids"));
        sell.extendAuction();
    }

    /* ========== startAuction ========== */

    function test_startAuction_requires_fifo_head() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        _mintAndSendToSell(owner);
        _mintAndSendToSell(owner);

        uint256 wrong = 999;
        vm.expectRevert(bytes("AuctionSell: not next in queue"));
        sell.startAuction(wrong);
    }

    /* ========== admin config ========== */

    function test_setTimeBuffer_only_owner() public {
        vm.prank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.setTimeBuffer(1);

        vm.expectEmit(false, false, false, true, address(sell));
        emit AuctionTimeBufferUpdated(60);
        vm.prank(owner);
        sell.setTimeBuffer(60);
        assertEq(sell.timeBuffer(), 60);
    }

    function test_setReservePrice_only_owner() public {
        vm.prank(bob);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.setReservePrice(1);

        vm.expectEmit(false, false, false, true, address(sell));
        emit AuctionReservePriceUpdated(123);
        vm.prank(owner);
        sell.setReservePrice(123);
        assertEq(sell.reservePrice(), 123);
    }

    function test_setMinBidIncrement_only_owner() public {
        vm.prank(carol);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.setMinBidIncrementPercentage(5);

        vm.expectEmit(false, false, false, true, address(sell));
        emit AuctionMinBidIncrementPercentageUpdated(15);
        vm.prank(owner);
        sell.setMinBidIncrementPercentage(15);
        assertEq(sell.minBidIncrementPercentage(), 15);
    }

    function test_setProceedsRecipient_only_owner_and_rejects_zero() public {
        address nextRecv = makeAddr("nextRecv");

        vm.prank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.setProceedsRecipient(nextRecv);

        vm.prank(owner);
        vm.expectRevert(bytes("AuctionSell: zero proceeds"));
        sell.setProceedsRecipient(address(0));

        vm.expectEmit(true, false, false, false, address(sell));
        emit ProceedsRecipientUpdated(nextRecv);
        vm.prank(owner);
        sell.setProceedsRecipient(nextRecv);
        assertEq(sell.proceedsRecipient(), nextRecv);
    }

    function test_pause_unpause_only_owner() public {
        assertTrue(sell.paused());

        vm.prank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.unpause();

        vm.prank(owner);
        sell.unpause();
        assertFalse(sell.paused());

        vm.prank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.pause();

        vm.prank(owner);
        sell.pause();
        assertTrue(sell.paused());
    }

    /* ========== compactQueue ========== */

    function test_compactQueue_shifts_and_resets_head() public {
        _mintAndSendToSell(owner);
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        assertEq(sell.queuedLength(), 0);

        _mintAndSendToSell(owner);
        _mintAndSendToSell(owner);
        vm.prank(bob);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        assertEq(sell.queuedLength(), 1);

        vm.prank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.compactQueue();

        vm.prank(owner);
        sell.compactQueue();
        assertEq(sell.queuedLength(), 1);
    }

    function test_compactQueue_drains_when_head_past_length() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        assertEq(sell.queuedLength(), 0);
        vm.prank(owner);
        sell.compactQueue();
    }

    /* ========== edge: wrong NFT contract cannot enqueue ========== */

    function test_onERC721Received_rejects_non_configured_collection() public {
        MockAuctionNFT other = new MockAuctionNFT();
        vm.prank(owner);
        uint256 oid = other.mint(owner);

        vm.prank(owner);
        vm.expectRevert(bytes("AuctionSell: only configured NFT"));
        other.safeTransferFrom(owner, address(sell), oid);
    }

    /* ========== currentAuction view ========== */

    function test_currentAuction_zero_when_settled() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        (uint256 id,,,) = sell.currentAuction();
        assertEq(id, 0);
    }
}
