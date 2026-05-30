// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {NFTReserve} from "../src/NFTReserve.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {INFTReserve} from "../src/interfaces/INFTReserve.sol";
import {MockAuctionNFT} from "./mocks/MockAuctionNFT.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @notice Non-`AuctionSell` integrator: only exercises `INFTReserve` queue mutations ( splice / pop ).
contract MockAlternateAuctionRunner {
    INFTReserve public immutable reserve;

    constructor(INFTReserve _reserve) {
        reserve = _reserve;
    }

    function splice(uint256 tokenId, uint256 prev, uint256 insertAfter) external {
        reserve.splice(tokenId, prev, insertAfter);
    }

    function pop() external returns (uint256) {
        return reserve.popHead();
    }

    function popAt(uint256 tokenId, uint256 prev) external returns (uint256) {
        return reserve.pop(tokenId, prev);
    }
}

/// @dev Second-generation runner used when simulating `AuctionSell` upgrade.
contract MockAlternateAuctionRunnerV2 is MockAlternateAuctionRunner {
    constructor(INFTReserve _reserve) MockAlternateAuctionRunner(_reserve) {}
}

contract NFTReserveTest is Test {
    NFTReserve internal reserve;
    MockAuctionNFT internal nft;
    GobbledWarplets internal gobbled;
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal setter = makeAddr("uriSetter");

    MockAlternateAuctionRunner internal auctionV1;
    MockAlternateAuctionRunnerV2 internal auctionV2;

    event TokenEnqueued(uint256 indexed tokenId);
    event QueueSpliced(uint256 indexed tokenId, uint256 indexed prev, uint256 indexed insertAfter);
    event QueuePopped(uint256 indexed tokenId);
    event AuctionUpdated(address indexed newAuction);
    event GobbledWarpletsUpdated(address indexed gobbledWarplets);

    function setUp() public {
        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        reserve = new NFTReserve(IERC721(address(nft)), owner);
        gobbled = new GobbledWarplets("Gobbled Test", "GTEST", address(reserve), setter);
        reserve.setGobbledWarplets(gobbled);
        vm.stopPrank();

        vm.prank(alice);
        nft.setApprovalForAll(address(reserve), true);
    }

    function _wireAuction(address auctionAddr) internal {
        vm.prank(owner);
        reserve.setAuction(auctionAddr);
    }

    function _deposit(address from, uint256 tokenId) internal {
        vm.prank(from);
        nft.safeTransferFrom(from, address(reserve), tokenId);
    }

    function _mintToReserve(uint256 n) internal returns (uint256 firstId) {
        firstId = nft.mint(alice);
        vm.prank(alice);
        nft.safeTransferFrom(alice, address(reserve), firstId);
        for (uint256 i = 1; i < n; i++) {
            uint256 tid = nft.mint(alice);
            _deposit(alice, tid);
        }
    }

    /* ========== receive / enqueue ========== */

    function test_receive_enqueues_fifo() public {
        _wireAuction(address(0x1));
        uint256 a = nft.mint(alice);
        uint256 b = nft.mint(alice);

        vm.expectEmit(true, true, true, true);
        emit TokenEnqueued(a);
        _deposit(alice, a);

        _deposit(alice, b);
        assertEq(reserve.head(), a);
        assertEq(reserve.tail(), b);
        assertEq(reserve.nextTokenId(a), b);
        assertEq(reserve.nextTokenId(b), 0);
        assertEq(reserve.queuedLength(), 2);

        uint256[] memory ids = reserve.getQueuedTokenIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], a);
        assertEq(ids[1], b);
    }

    function test_receive_revert_wrong_collection() public {
        // Another contract calling receiver as if it were `nft` — reserve checks msg.sender.
        Malicious721 evil = new Malicious721();
        vm.prank(alice);
        vm.expectRevert("NFTReserve: only configured NFT");
        evil.safeTransferToReserveWithFakeSender(address(reserve), 1);
    }

    function test_receive_revert_double_queue_same_id() public {
        uint256 tid = nft.mint(alice);
        vm.startPrank(address(nft));
        IERC721Receiver(address(reserve)).onERC721Received(alice, alice, tid, "");
        vm.expectRevert("NFTReserve: already queued");
        IERC721Receiver(address(reserve)).onERC721Received(alice, alice, tid, "");
        vm.stopPrank();
    }

    function test_nextTokenId_revert_zero() public {
        vm.expectRevert("NFTReserve: zero token");
        reserve.nextTokenId(0);
    }

    /* ========== splice / pop ACL ========== */

    function test_splice_pop_revert_not_auction() public {
        uint256 a = _mintToReserve(2);
        uint256 b = reserve.nextTokenId(a);
        vm.expectRevert("NFTReserve: not auction");
        reserve.splice(b, a, 0);
        vm.expectRevert("NFTReserve: not auction");
        reserve.popHead();
    }

    function test_splice_revert_single_item_queue() public {
        _mintToReserve(1);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));
        uint256 h = reserve.head();
        vm.expectRevert("NFTReserve: cannot splice single item queue");
        auctionV1.splice(h, 0, 0);
    }

    function test_splice_prepend_insertAfter_zero() public {
        uint256 a = _mintToReserve(2);
        uint256 b = reserve.nextTokenId(a);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        vm.expectEmit(true, true, true, true);
        emit QueueSpliced(b, a, 0);
        auctionV1.splice(b, a, 0);

        assertEq(reserve.head(), b);
        assertEq(reserve.nextTokenId(b), a);
        assertEq(reserve.nextTokenId(a), 0);
        assertEq(reserve.tail(), a);
    }

    function test_splice_after_interior_updates_pointers() public {
        uint256 t1 = _mintToReserve(3);
        uint256 t2 = reserve.nextTokenId(t1);
        uint256 t3 = reserve.nextTokenId(t2);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        auctionV1.splice(t3, t2, t1);

        assertEq(reserve.nextTokenId(t1), t3);
        assertEq(reserve.nextTokenId(t3), t2);
        assertEq(reserve.nextTokenId(t2), 0);
        assertEq(reserve.tail(), t2);
    }

    function test_splice_after_head() public {
        uint256 t1 = _mintToReserve(3);
        uint256 t2 = reserve.nextTokenId(t1);
        uint256 t3 = reserve.nextTokenId(t2);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        auctionV1.splice(t3, t2, t1);
        assertEq(reserve.head(), t1);
    }

    function test_splice_bad_prev_reverts() public {
        uint256 t1 = _mintToReserve(2);
        uint256 t2 = reserve.nextTokenId(t1);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        vm.expectRevert("NFTReserve: bad prev");
        auctionV1.splice(t2, 0, 0);

        vm.expectRevert("NFTReserve: bad prev");
        auctionV1.splice(t2, t2, 0);
    }

    function test_splice_self_after_reverts() public {
        uint256 t1 = _mintToReserve(2);
        uint256 t2 = reserve.nextTokenId(t1);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        vm.expectRevert("NFTReserve: bad insertAfter");
        auctionV1.splice(t2, t1, t2);
    }

    function test_pop_fifo() public {
        uint256 t1 = _mintToReserve(2);
        uint256 t2 = reserve.nextTokenId(t1);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        vm.expectEmit(true, true, true, true);
        emit QueuePopped(t1);
        uint256 p = auctionV1.pop();
        assertEq(p, t1);
        assertEq(reserve.head(), t2);
        assertEq(reserve.queuedLength(), 1);

        auctionV1.pop();
        assertEq(reserve.head(), 0);
        assertEq(reserve.tail(), 0);
        assertEq(reserve.queuedLength(), 0);
    }

    function test_pop_revert_empty() public {
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));
        vm.expectRevert("NFTReserve: empty queue");
        auctionV1.pop();
    }

    /* ========== alternate auction integrator ========== */

    function test_alternate_runner_can_mutate_queue_when_wired() public {
        uint256 t1 = _mintToReserve(2);
        uint256 t2 = reserve.nextTokenId(t1);
        MockAlternateAuctionRunner alt = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(alt));

        alt.splice(t2, t1, 0);
        assertEq(reserve.head(), t2);

        uint256 p = alt.pop();
        assertEq(p, t2);
        assertEq(reserve.head(), t1);
    }

    /* ========== upgrade auction runner (reserve.setAuction) ========== */

    function test_upgrade_auction_runner_syncs_gobbled_and_revokes_old_runner() public {
        uint256 t1 = _mintToReserve(2);
        uint256 t2 = reserve.nextTokenId(t1);

        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        auctionV2 = new MockAlternateAuctionRunnerV2(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));
        assertEq(gobbled.auction(), address(auctionV1));

        auctionV1.splice(t2, t1, 0);

        vm.prank(owner);
        reserve.setAuction(address(auctionV2));
        assertEq(reserve.auction(), address(auctionV2));
        assertEq(gobbled.auction(), address(auctionV2));

        vm.expectRevert("NFTReserve: not auction");
        auctionV1.splice(t1, 0, t2);

        auctionV2.splice(t1, t2, 0);
        assertEq(reserve.head(), t1);
    }

    function test_setAuction_reverts_until_gobbled_configured() public {
        vm.startPrank(owner);
        NFTReserve r2 = new NFTReserve(IERC721(address(nft)), owner);
        MockAlternateAuctionRunner alt = new MockAlternateAuctionRunner(INFTReserve(address(r2)));
        vm.expectRevert();
        r2.setAuction(address(alt));

        GobbledWarplets g2 = new GobbledWarplets("G2", "G2", address(r2), setter);
        r2.setGobbledWarplets(g2);
        r2.setAuction(address(alt));
        vm.stopPrank();

        assertEq(g2.auction(), address(alt));
        assertEq(r2.auction(), address(alt));
    }

    function test_pop_non_head_tail_pops_via_prev_hint() public {
        uint256 t1 = _mintToReserve(3);
        uint256 t2 = reserve.nextTokenId(t1);
        uint256 t3 = reserve.nextTokenId(t2);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        vm.expectEmit(true, true, true, true);
        emit QueuePopped(t3);
        uint256 p = auctionV1.popAt(t3, t2);
        assertEq(p, t3);
        assertEq(reserve.tail(), t2);
        assertEq(reserve.nextTokenId(t2), 0);
        assertEq(reserve.queuedLength(), 2);

        auctionV1.pop();
        auctionV1.pop();
        assertEq(reserve.queuedLength(), 0);
    }

    function test_pop_non_head_interior_pops_via_prev_hint() public {
        uint256 t1 = _mintToReserve(3);
        uint256 t2 = reserve.nextTokenId(t1);
        uint256 t3 = reserve.nextTokenId(t2);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        auctionV1.popAt(t2, t1);
        assertEq(reserve.head(), t1);
        assertEq(reserve.nextTokenId(t1), t3);
        assertEq(reserve.tail(), t3);
        assertEq(reserve.queuedLength(), 2);
    }

    function test_splice_noop_insert_after_equals_prev_reverts() public {
        uint256 t1 = _mintToReserve(2);
        uint256 t2 = reserve.nextTokenId(t1);
        auctionV1 = new MockAlternateAuctionRunner(INFTReserve(address(reserve)));
        _wireAuction(address(auctionV1));

        vm.expectRevert("NFTReserve: noop splice");
        auctionV1.splice(t2, t1, t1);
    }

    /* ========== ownership / config ========== */

    function test_setAuction_only_owner_emits() public {
        vm.expectEmit(true, true, true, true);
        emit AuctionUpdated(alice);
        vm.prank(owner);
        reserve.setAuction(alice);
        assertEq(reserve.auction(), alice);

        vm.prank(alice);
        vm.expectRevert();
        reserve.setAuction(owner);
    }

    function test_setGobbledWarplets_once_and_sets_approval() public {
        vm.startPrank(owner);
        NFTReserve r2 = new NFTReserve(IERC721(address(nft)), owner);
        GobbledWarplets g2 = new GobbledWarplets("G2", "G2", address(r2), setter);

        vm.expectEmit(true, true, true, true);
        emit GobbledWarpletsUpdated(address(g2));
        r2.setGobbledWarplets(g2);

        vm.expectRevert("NFTReserve: gobbled already set");
        r2.setGobbledWarplets(g2);
        vm.stopPrank();

        assertTrue(nft.isApprovedForAll(address(r2), address(g2)));
    }

    function test_INFTReserve_views() public view {
        assertEq(address(reserve.nft()), address(nft));
        assertEq(address(reserve.gobbledWarplets()), address(gobbled));
    }
}

/// @dev Calls `onERC721Received` on the reserve with `msg.sender` forged as this contract (fails reserve check).
contract Malicious721 {
    function safeTransferToReserveWithFakeSender(address reserve, uint256 tokenId) external {
        IERC721Receiver(reserve).onERC721Received(address(0), address(0), tokenId, "");
    }
}
