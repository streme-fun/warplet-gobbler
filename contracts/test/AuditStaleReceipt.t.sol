// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {MockBidToken} from "./mocks/MockBidToken.sol";
import {MockAuctionNFT} from "./mocks/MockAuctionNFT.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Documents stale-receipt behavior: the theft path is not reachable through `AuctionSell`,
///         only through pathological direct `reserve()` calls (custom / test minter).
contract AuditStaleReceiptTest is Test {
    using MessageHashUtils for bytes32;

    AuctionSell internal sell;
    GobbledWarplets internal gobbled;
    MockAuctionNFT internal nft;
    MockBidToken internal bidToken;

    address internal owner = makeAddr("owner");
    address internal proceeds = makeAddr("proceeds");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant SETTER_PK = 0xC0FFEE;
    address internal setter;

    uint256 internal constant DURATION = 24 hours;
    uint256 internal constant TIME_BUFFER = 5 minutes;
    uint256 internal constant RESERVE_PRICE = 10_000_000 * 1e18;
    uint8 internal constant MIN_INCREMENT_PCT = 10;

    bytes32 internal constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant _MINT_TYPEHASH =
        keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");
    string internal constant URI = "ipfs://gobbled";

    function setUp() public {
        setter = vm.addr(SETTER_PK);
        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        bidToken = new MockBidToken();
        gobbled = new GobbledWarplets("Gobbled", "GOB", owner, setter);
        sell = new AuctionSell(
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
        gobbled.setMinter(address(sell));
        vm.stopPrank();

        bidToken.mint(alice, RESERVE_PRICE * 10);
        bidToken.mint(bob, RESERVE_PRICE * 10);
        vm.prank(alice);
        bidToken.approve(address(sell), type(uint256).max);
        vm.prank(bob);
        bidToken.approve(address(sell), type(uint256).max);
    }

    function _sign(uint256 tokenId) internal view returns (bytes memory) {
        uint256 deadline = block.timestamp + 1 days;
        bytes32 structHash =
            keccak256(abi.encode(_MINT_TYPEHASH, tokenId, keccak256(bytes(URI)), deadline));
        bytes32 domain = keccak256(
            abi.encode(
                _DOMAIN_TYPEHASH,
                keccak256(bytes("Gobbled")),
                keccak256(bytes("1")),
                block.chainid,
                address(gobbled)
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(domain, structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SETTER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Production path: first winner must rescue before the Warplet can be re-queued and won again.
    function test_auctionSell_regobble_gives_warplet_to_second_winner() public {
        uint256 wid = 100;
        vm.prank(owner);
        nft.mintSpecific(owner, wid);
        vm.prank(owner);
        nft.safeTransferFrom(owner, address(sell), wid);

        vm.prank(owner);
        sell.unpause();

        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        uint256 receipt0 = wid;
        assertEq(gobbled.gobbleCount(wid), 1);
        assertEq(nft.ownerOf(wid), address(sell));

        _completeSignedRescue(alice, receipt0);
        assertEq(nft.ownerOf(wid), alice);

        vm.prank(alice);
        nft.safeTransferFrom(alice, address(sell), wid);

        vm.prank(owner);
        sell.startAuction(wid);

        vm.prank(bob);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        uint256 receipt1 = gobbled.WARPLET_ID_PADDING() + wid;
        assertEq(gobbled.gobbleCount(wid), 2);

        _completeSignedRescue(bob, receipt1);
        assertEq(nft.ownerOf(wid), bob, "second winner should receive the Warplet");
    }

    /// @dev If a minter could `reserve` twice while the NFT never left custody, the first winner
    ///      could pull it from under the second — not reachable via `AuctionSell` settlement.
    function test_mock_only_stale_receipt_pull_steals_from_second_reservation() public {
        vm.prank(owner);
        nft.mintSpecific(address(sell), 100);

        vm.prank(address(sell));
        uint256 receipt0 = gobbled.reserve(alice, 100);

        vm.prank(address(sell));
        uint256 receipt1 = gobbled.reserve(bob, 100);
        assertEq(nft.ownerOf(100), address(sell));

        vm.prank(alice);
        _completeSignedRescue(alice, receipt0);
        assertEq(nft.ownerOf(100), alice, "first winner pulls the Warplet via signed rescue");

        vm.prank(bob);
        vm.expectRevert();
        _completeSignedRescue(bob, receipt1);
    }

    function _completeSignedRescue(address winner, uint256 gobbledTokenId) internal {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(winner);
        gobbled.rescueWarplet(gobbledTokenId, URI, deadline, _sign(gobbledTokenId));
    }
}
