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
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AuctionSellTest is Test {
    using MessageHashUtils for bytes32;
    AuctionSell internal sell;
    GobbledWarplets internal gobbled;
    MockAuctionNFT internal nft;
    MockBidToken internal bidToken;

    address internal owner = makeAddr("owner");
    address internal proceeds = makeAddr("proceeds");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant GOBBLED_SETTER_PK = 0xA11CE;
    bytes32 internal constant _GOBBLED_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant _GOBBLED_MINT_TYPEHASH =
        keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");
    address internal gobbledSetter;
    string internal constant GOBBLED_URI = "ipfs://gobbled-test";

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
    event QueueBumpFeeUpdated(uint256 queueBumpFee);
    event QueueBumped(address indexed payer, uint256 indexed tokenId, uint256 fee);
    event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount, uint256 gobbledTokenId);

    function setUp() public {
        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        bidToken = new MockBidToken();
        gobbledSetter = vm.addr(GOBBLED_SETTER_PK);
        gobbled = new GobbledWarplets("Gobbled Warplets", "GOBBLED", owner, gobbledSetter);
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

    function _gobbledDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                _GOBBLED_DOMAIN_TYPEHASH,
                keccak256(bytes("Gobbled Warplets")),
                keccak256(bytes("1")),
                block.chainid,
                address(gobbled)
            )
        );
    }

    function _signGobbledMint(uint256 tokenId, string memory uri, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(_GOBBLED_MINT_TYPEHASH, tokenId, keccak256(bytes(uri)), deadline));
        bytes32 digest = _gobbledDomainSeparator().toTypedDataHash(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(GOBBLED_SETTER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Settlement only `reserve`s the GobbledWarplets id and leaves the underlying Warplet in
    ///      the auction. Tests finish the flow with the winner's signed `rescueWarplet` overload, which
    ///      mints the receipt with metadata AND pulls the underlying NFT in one tx.
    function _completeReservedGobbled(address recipient, uint256 gobbledTokenId) internal {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signGobbledMint(gobbledTokenId, GOBBLED_URI, deadline);
        vm.prank(recipient);
        gobbled.rescueWarplet(gobbledTokenId, GOBBLED_URI, deadline, sig);
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

    function test_settle_reserves_gobbled_winner_mints_receipt() public {
        uint256 wid = _mintAndSendToSell(owner);
        _unpauseStartsAuction(wid);

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);

        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        _completeReservedGobbled(alice, wid);

        assertEq(nft.ownerOf(wid), alice);
        assertEq(gobbled.balanceOf(alice), 1);
        assertEq(gobbled.ownerOf(wid), alice);
    }

    /* ========== ERC777 queue bump ========== */

    function test_tokensReceived_bump_moves_later_queued_to_head() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);

        vm.prank(owner);
        sell.unpause();

        assertEq(sell.nextQueuedTokenId(), t2);

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.expectEmit(true, true, false, true, address(sell));
        emit QueueBumped(alice, t3, fee);
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");

        assertEq(sell.nextQueuedTokenId(), t3);
        (uint256 activeId,,,,,) = sell.auction();
        assertEq(t1, activeId);
    }

    function test_bump_second_position_moves_to_front_with_prev_hint() public {
        _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);

        vm.prank(owner);
        sell.unpause();
        assertEq(sell.nextQueuedTokenId(), t2);

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");

        assertEq(sell.nextQueuedTokenId(), t3);
        uint256[] memory q = sell.getQueuedTokenIds();
        assertEq(q.length, 2);
        assertEq(q[0], t3);
        assertEq(q[1], t2);
    }

    function test_last_bumper_is_next_in_line_after_settle() public {
        _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);

        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee * 2);
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t2, t3), "");

        assertEq(sell.nextQueuedTokenId(), t2);

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        (uint256 activeId,,,) = sell.currentAuction();
        assertEq(activeId, t2);
    }

    function test_tokensReceived_bump_revert_if_not_in_queue() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: bad prev"));
        // t1 is in the live auction; queue is only t2 — next[t2] != t1
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t1, t2), "");
    }

    function test_tokensReceived_bump_revert_when_paused() public {
        _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);

        vm.prank(owner);
        sell.unpause();
        assertEq(sell.nextQueuedTokenId(), t2);

        vm.prank(owner);
        sell.pause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectPartialRevert(Pausable.EnforcedPause.selector);
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");
    }

    function test_tokensReceived_with_32byte_userData_and_non_fee_amount_is_bid() public {
        uint256 t1 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);

        uint256 bobBid = RESERVE_PRICE + (RESERVE_PRICE * MIN_INCREMENT_PCT) / 100;
        bidToken.mint(address(sell), bobBid);
        bytes memory userData = abi.encode(uint256(12345));
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), bob, address(0), bobBid, userData, "");

        (, address highBidder,,) = sell.currentAuction();
        assertEq(highBidder, bob);
        (uint256 activeId,,,,,) = sell.auction();
        assertEq(t1, activeId);
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

        (,,, uint256 endBefore) = sell.currentAuction();
        uint256 warpTo = endBefore - 3 minutes;
        vm.warp(warpTo);

        vm.expectEmit(true, false, false, true, address(sell));
        emit AuctionExtended(tid, warpTo + TIME_BUFFER);

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);

        (,,, uint256 endAfter) = sell.currentAuction();
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

        _completeReservedGobbled(alice, t1);

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

    function test_settle_two_auctions_same_warplet_reserve_then_winners_mint() public {
        uint256 wid = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        _completeReservedGobbled(alice, wid);

        assertEq(gobbled.ownerOf(wid), alice);
        assertEq(nft.ownerOf(wid), alice);

        vm.prank(alice);
        nft.safeTransferFrom(alice, address(sell), wid);
        sell.startAuction(wid);

        vm.prank(bob);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        uint256 stride = gobbled.WARPLET_ID_PADDING();
        uint256 secondGobbledId = stride + wid;
        _completeReservedGobbled(bob, secondGobbledId);
        assertEq(gobbled.ownerOf(secondGobbledId), bob);
        assertEq(gobbled.warpletOf(secondGobbledId), wid);
        assertEq(gobbled.gobbleIndexOf(secondGobbledId), 1);
        assertEq(gobbled.totalSupply(), 2);
        assertEq(gobbled.tokenOfOwnerByIndex(alice, 0), wid);
        assertEq(gobbled.tokenOfOwnerByIndex(bob, 0), secondGobbledId);
        assertEq(gobbled.tokenByIndex(0), wid);
        assertEq(gobbled.tokenByIndex(1), secondGobbledId);
    }

    function test_settleCurrent_reverts_when_gobbled_reserve_fails_warplet_id_too_large() public {
        vm.prank(owner);
        uint256 badId = nft.mintSpecific(owner, gobbled.WARPLET_ID_PADDING());

        vm.prank(owner);
        nft.safeTransferFrom(owner, address(sell), badId);

        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        uint256 proceedsBefore = bidToken.balanceOf(proceeds);
        vm.expectRevert(bytes("GobbledWarplets: warpletId too large"));
        sell.settleCurrentAndCreateNewAuction();

        assertEq(nft.ownerOf(badId), address(sell));
        assertEq(gobbled.totalSupply(), 0);
        assertEq(bidToken.balanceOf(proceeds), proceedsBefore);
        (,,,,, bool settled) = sell.auction();
        assertFalse(settled);
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

        // Settlement no longer transfers the underlying Warplet — it stays in the auction until the
        // winner pulls it via `GobbledWarplets.rescueWarplet`.
        assertEq(nft.ownerOf(tid), address(sell));
        assertEq(bidToken.balanceOf(proceeds), RESERVE_PRICE);

        _completeReservedGobbled(alice, tid);
        assertEq(nft.ownerOf(tid), alice);
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

        (,,, uint256 end) = sell.currentAuction();
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

    function test_setQueueBumpFee_only_owner() public {
        assertEq(sell.queueBumpFee(), 1_000_000 * 1e18);

        vm.prank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        sell.setQueueBumpFee(1);

        uint256 nextFee = 500_000 * 1e18;
        vm.expectEmit(false, false, false, true, address(sell));
        emit QueueBumpFeeUpdated(nextFee);
        vm.prank(owner);
        sell.setQueueBumpFee(nextFee);
        assertEq(sell.queueBumpFee(), nextFee);
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

    /* ========== mapping queue: no compaction needed ========== */

    function test_mappingQueue_queuedLength_after_settles_without_compact() public {
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

    /* ========== views & bump prev-hint edge cases ========== */

    function test_getQueuedTokenIds_empty() public view {
        uint256[] memory q = sell.getQueuedTokenIds();
        assertEq(q.length, 0);
    }

    function test_bump_reverts_wrong_prev_for_auctioned_token() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: bad prev"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t1, t2), "");
    }

    function test_bump_reverts_bad_prev_self_not_predecessor() public {
        _mintAndSendToSell(owner);
        _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: bad prev"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t3), "");
    }

    function test_bump_reverts_wrong_token_for_prev() public {
        uint256 t1 = _mintAndSendToSell(owner);
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: bad prev"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t1, t1), "");
    }

    function test_bump_tail_moves_to_front() public {
        _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");

        assertEq(sell.queuedLength(), 2);
        assertEq(sell.nextQueuedTokenId(), t3);
    }

    function test_bump_transfers_fee_to_proceeds_recipient() public {
        _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        uint256 beforeP = bidToken.balanceOf(proceeds);
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");

        assertEq(bidToken.balanceOf(proceeds), beforeP + fee);
    }

    function test_bump_twice_same_token_second_call_reverts() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee * 2);
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: already first"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t3, t2), "");
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: bad prev"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t2, t1), "");
    }

    function test_bump_non_head_while_first_auction_live() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        uint256 t3 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256[] memory q0 = sell.getQueuedTokenIds();
        assertEq(q0.length, 2);
        assertEq(q0[0], t2);
        assertEq(q0[1], t3);

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        sell.tokensReceived(address(0), bob, address(0), fee, abi.encode(t3, t2), "");
        assertEq(sell.nextQueuedTokenId(), t3);
        (uint256 activeId,,,,,) = sell.auction();
        assertEq(activeId, t1);
    }

    function test_bump_reverts_already_first() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: already first"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t2, t1), "");
    }

    function test_nextQueuedTokenId_reverts_when_fully_drained() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        vm.expectRevert(bytes("AuctionSell: empty queue"));
        sell.nextQueuedTokenId();
    }

    /* ========== tokensReceived routing ========== */

    function test_tokensReceived_non_bidToken_msgSender_reverts() public {
        _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(alice);
        vm.expectRevert(bytes("AuctionSell: only configured token"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(t2, uint256(1)), "");
    }

    function test_tokensReceived_bump_fee_with_non_64_byte_userData_treated_as_bid_below_reserve() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        require(fee < RESERVE_PRICE, "test assumes bump fee < reserve");
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: below reserve"));
        sell.tokensReceived(address(0), alice, address(0), fee, hex"abcd", "");
    }

    function test_tokensReceived_bump_fee_32_byte_userData_treated_as_bid_below_reserve() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: below reserve"));
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(uint256(123)), "");
    }

    function test_tokensReceived_bid_reverts_when_no_auction_live() public {
        vm.prank(owner);
        sell.unpause();

        uint256 amt = RESERVE_PRICE;
        bidToken.mint(address(sell), amt);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: no auction"));
        sell.tokensReceived(address(0), alice, address(0), amt, "", "");
    }

    function test_tokensReceived_bid_reverts_after_auction_expired() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.warp(block.timestamp + DURATION + 1);
        bidToken.mint(address(sell), RESERVE_PRICE);
        vm.prank(address(bidToken));
        vm.expectRevert(bytes("AuctionSell: expired"));
        sell.tokensReceived(address(0), alice, address(0), RESERVE_PRICE, "", "");
    }

    function test_bid_reverts_when_previous_auction_struct_still_marked_settled() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(owner);
        sell.pause();
        sell.settle();
        vm.prank(owner);
        sell.unpause();

        vm.prank(bob);
        vm.expectRevert(bytes("AuctionSell: settled"));
        sell.bid(RESERVE_PRICE);
    }

    function test_bump_reverts_for_nonexistent_tokenId() public {
        _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();

        uint256 fee = sell.queueBumpFee();
        bidToken.mint(address(sell), fee);
        vm.prank(address(bidToken));
        vm.expectRevert();
        sell.tokensReceived(address(0), alice, address(0), fee, abi.encode(uint256(999_999), t2), "");
    }

    /* ========== startAuction / extendAuction / settle edge cases ========== */

    function test_startAuction_reverts_when_auction_already_live() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        (uint256 cur,,,) = sell.currentAuction();
        assertGt(cur, 0);
        vm.expectRevert(bytes("AuctionSell: auction live"));
        sell.startAuction(cur);
    }

    function test_extendAuction_reverts_while_auction_still_live() public {
        _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.expectRevert(bytes("AuctionSell: still live"));
        sell.extendAuction();
    }

    function test_extendAuction_reverts_when_no_auction_started() public {
        vm.prank(owner);
        sell.unpause();
        vm.expectRevert(bytes("AuctionSell: no auction"));
        sell.extendAuction();
    }

    function test_settle_when_paused_does_not_auto_start_next_auction() public {
        uint256 t1 = _mintAndSendToSell(owner);
        uint256 t2 = _mintAndSendToSell(owner);
        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(owner);
        sell.pause();
        sell.settle();

        (uint256 cur,,,) = sell.currentAuction();
        assertEq(cur, 0);
        assertEq(sell.nextQueuedTokenId(), t2);
        // Underlying Warplet stays in the auction until the winner calls `rescueWarplet`.
        assertEq(nft.ownerOf(t1), address(sell));

        _completeReservedGobbled(alice, t1);
        assertEq(nft.ownerOf(t1), alice);
    }

    function test_settle_emits_AuctionSettled_with_gobbled_token_id() public {
        uint256 wid = _mintAndSendToSell(owner);
        _unpauseStartsAuction(wid);

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(owner);
        sell.pause();

        vm.expectEmit(true, true, false, true, address(sell));
        emit AuctionSettled(wid, alice, RESERVE_PRICE, wid);
        sell.settle();
    }

    function test_settle_when_paused_reverts_when_gobbled_reserve_fails_warplet_id_too_large() public {
        uint256 aliceGobbledBalanceBefore = gobbled.balanceOf(alice);

        vm.prank(owner);
        uint256 badId = nft.mintSpecific(owner, gobbled.WARPLET_ID_PADDING());

        vm.prank(owner);
        nft.safeTransferFrom(owner, address(sell), badId);

        vm.prank(owner);
        sell.unpause();
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(owner);
        sell.pause();

        vm.expectRevert(bytes("GobbledWarplets: warpletId too large"));
        sell.settle();

        vm.assertEq(gobbled.balanceOf(alice), aliceGobbledBalanceBefore);
        vm.assertEq(nft.ownerOf(badId), address(sell));
        (,,,,, bool settled) = sell.auction();
        vm.assertFalse(settled);
    }
}
