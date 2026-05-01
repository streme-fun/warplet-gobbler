// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {NFTReserve} from "../src/NFTReserve.sol";
import {MockBidToken} from "./mocks/MockBidToken.sol";
import {MockAuctionNFT} from "./mocks/MockAuctionNFT.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice `NFTReserve.setAuction(successor)` — swap canonical `AuctionSell` while GobbledWarplets /
///         FIFO reserve custody stay immutable.
contract AuctionSellMigrationTest is Test {
    using MessageHashUtils for bytes32;

    AuctionSell internal sellV1;
    AuctionSell internal sellV2;
    GobbledWarplets internal gobbled;
    NFTReserve internal reserve;
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
    string internal constant GOBBLED_URI = "ipfs://gobbled-migrate";

    uint256 internal constant DURATION = 24 hours;
    uint256 internal constant TIME_BUFFER = 5 minutes;
    uint256 internal constant RESERVE_PRICE = 10_000_000 * 1e18;
    uint8 internal constant MIN_INCREMENT_PCT = 10;
    uint256 internal constant BID_TOKEN_SEED = 500_000_000 * 1e18;

    function setUp() public {
        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        bidToken = new MockBidToken();
        gobbledSetter = vm.addr(GOBBLED_SETTER_PK);
        reserve = new NFTReserve(IERC721(address(nft)), owner);
        gobbled = new GobbledWarplets("G Warplets Mig", "GWM", address(reserve), gobbledSetter);
        reserve.setGobbledWarplets(gobbled);
        sellV1 = new AuctionSell(
            IERC721(address(nft)),
            bidToken,
            gobbled,
            proceeds,
            TIME_BUFFER,
            RESERVE_PRICE,
            MIN_INCREMENT_PCT,
            DURATION,
            owner,
            address(0)
        );
        reserve.setAuction(address(sellV1));
        vm.stopPrank();

        bidToken.mint(alice, BID_TOKEN_SEED);
        bidToken.mint(bob, BID_TOKEN_SEED);
        bidToken.mint(carol, BID_TOKEN_SEED);

        _approveBidders(address(sellV1));
    }

    function _approveBidders(address auctionAddr) internal {
        vm.prank(alice);
        bidToken.approve(auctionAddr, type(uint256).max);
        vm.prank(bob);
        bidToken.approve(auctionAddr, type(uint256).max);
        vm.prank(carol);
        bidToken.approve(auctionAddr, type(uint256).max);
    }

    function _deploySellNext() internal {
        vm.prank(owner);
        sellV2 = new AuctionSell(
            IERC721(address(nft)),
            bidToken,
            gobbled,
            proceeds,
            TIME_BUFFER,
            RESERVE_PRICE,
            MIN_INCREMENT_PCT,
            DURATION,
            owner,
            address(0)
        );
    }

    function _gobbledDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                _GOBBLED_DOMAIN_TYPEHASH,
                keccak256(bytes("G Warplets Mig")),
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

    function _completeReservedGobbled(address recipient, uint256 gobbledTokenId) internal {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signGobbledMint(gobbledTokenId, GOBBLED_URI, deadline);
        vm.prank(recipient);
        gobbled.rescueWarplet(gobbledTokenId, GOBBLED_URI, deadline, sig);
    }

    function _mintAndSendToReserve(address from) internal returns (uint256 tokenId) {
        vm.prank(owner);
        tokenId = nft.mint(from);
        vm.prank(from);
        nft.safeTransferFrom(from, address(reserve), tokenId);
    }

    function test_migration_setAuction_updates_reserve_and_gobbled() public {
        assertEq(address(gobbled.auction()), address(sellV1));

        _deploySellNext();
        vm.prank(owner);
        reserve.setAuction(address(sellV2));

        assertEq(reserve.auction(), address(sellV2));
        assertEq(address(gobbled.auction()), address(sellV2));
    }

    function test_migration_old_auction_contract_cannot_mutate_reserve_queue() public {
        _mintAndSendToReserve(owner);
        uint256 t2 = _mintAndSendToReserve(owner);
        uint256 t3 = _mintAndSendToReserve(owner);

        vm.prank(owner);
        sellV1.unpause();
        assertEq(sellV1.nextQueuedTokenId(), t2);

        _deploySellNext();
        vm.prank(owner);
        reserve.setAuction(address(sellV2));

        vm.prank(alice);
        vm.expectRevert(bytes("NFTReserve: not auction"));
        sellV1.bump(t3, t2);
    }

    function test_migration_pause_v1_blocks_new_bids_on_stale_contract() public {
        _mintAndSendToReserve(owner);
        vm.prank(owner);
        sellV1.unpause();

        _deploySellNext();
        _approveBidders(address(sellV2));
        vm.prank(owner);
        reserve.setAuction(address(sellV2));

        vm.prank(owner);
        sellV1.pause();

        vm.prank(alice);
        vm.expectPartialRevert(Pausable.EnforcedPause.selector);
        sellV1.bid(RESERVE_PRICE);
    }

    function test_migration_v1_settled_handoff_to_v2_runs_remainder_auction() public {
        uint256 t1 = _mintAndSendToReserve(owner);
        uint256 t2 = _mintAndSendToReserve(owner);

        vm.prank(owner);
        sellV1.unpause();
        vm.prank(alice);
        sellV1.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sellV1.settleCurrentAndCreateNewAuction();

        (uint256 tailId,,,) = sellV1.currentAuction();
        assertEq(tailId, t2);

        vm.prank(owner);
        sellV1.pause();

        _deploySellNext();
        _approveBidders(address(sellV2));
        vm.prank(owner);
        reserve.setAuction(address(sellV2));

        vm.prank(owner);
        sellV2.unpause();
        (uint256 v2Id,,,) = sellV2.currentAuction();
        assertEq(v2Id, t2);

        vm.prank(bob);
        sellV2.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sellV2.settleCurrentAndCreateNewAuction();

        _completeReservedGobbled(bob, t2);
        assertEq(nft.ownerOf(t2), bob);
        assertEq(gobbled.ownerOf(t2), bob);

        _completeReservedGobbled(alice, t1);
        assertEq(nft.ownerOf(t1), alice);
    }

    /// @dev If V1 escrowed bids remain after handoff and `reserve.setAuction(V2)`, V1 settlements can no longer
    ///      call `GobbledWarplets.createReceipt` (only the current `auction` address may). Survivor path: run subsequent
    ///      lots exclusively on `sellV2` (shows stuck Alice escrow on abandoned V1 unless settled pre-migrate).
    function test_migration_v1_settle_reverts_when_gobbled_points_at_successor_auction() public {
        uint256 tid = _mintAndSendToReserve(owner);
        vm.prank(owner);
        sellV1.unpause();
        vm.prank(alice);
        sellV1.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(owner);
        sellV1.pause();

        _deploySellNext();
        _approveBidders(address(sellV2));
        vm.prank(owner);
        reserve.setAuction(address(sellV2));

        assertEq(bidToken.balanceOf(address(sellV1)), RESERVE_PRICE);

        vm.expectRevert(bytes("GobbledWarplets: not auction"));
        sellV1.settle();

        vm.prank(owner);
        sellV2.unpause();
        vm.prank(bob);
        sellV2.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sellV2.settleCurrentAndCreateNewAuction();
        _completeReservedGobbled(bob, tid);
        assertEq(nft.ownerOf(tid), bob);
        assertEq(bidToken.balanceOf(address(sellV1)), RESERVE_PRICE);
    }

    function test_migration_reserve_queue_preserved_through_handoff() public {
        uint256 t1 = _mintAndSendToReserve(owner);
        uint256 t2 = _mintAndSendToReserve(owner);

        assertEq(reserve.queuedLength(), 2);

        vm.prank(owner);
        sellV1.unpause();
        assertEq(reserve.head(), t1);

        _deploySellNext();
        _approveBidders(address(sellV2));
        vm.prank(owner);
        reserve.setAuction(address(sellV2));

        assertEq(reserve.queuedLength(), 2);

        vm.prank(owner);
        sellV1.pause();

        vm.prank(owner);
        sellV2.unpause();
        (uint256 id,,,) = sellV2.currentAuction();
        assertEq(id, t1);

        vm.prank(alice);
        sellV2.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sellV2.settleCurrentAndCreateNewAuction();
        assertEq(reserve.head(), t2);

        vm.prank(bob);
        sellV2.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sellV2.settleCurrentAndCreateNewAuction();
        _completeReservedGobbled(alice, t1);
        _completeReservedGobbled(bob, t2);
    }
}
