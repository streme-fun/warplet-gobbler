// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionSell} from "../../src/AuctionSell.sol";
import {GobbledWarplets} from "../../src/GobbledWarplets.sol";
import {NFTReserve} from "../../src/NFTReserve.sol";
import {MockBidToken} from "../mocks/MockBidToken.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Fork test: end-to-end auction settlement + rescue against the **real Warplets ERC721** on
///         Base. Skipped automatically when `WARPLETS_NFT_ADDRESS` or `WARPLETS_FORK_TOKEN_ID` are not
///         set in the environment, so it stays out of the default `forge test` run.
///
/// Required env (otherwise tests skip):
/// - `BASE_RPC_URL`           (default: `https://mainnet.base.org`)
/// - `WARPLETS_NFT_ADDRESS`   the live Warplets ERC721 on Base
/// - `WARPLETS_FORK_TOKEN_ID` a token id to borrow from its current owner
/// Optional:
/// - `WARPLETS_FORK_BLOCK`    pin the fork to a specific block
contract RescueWarpletsForkTest is Test {
    using MessageHashUtils for bytes32;

    string internal constant DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";

    uint256 internal constant DURATION = 24 hours;
    uint256 internal constant TIME_BUFFER = 5 minutes;
    uint256 internal constant RESERVE_PRICE = 1e18;
    uint8 internal constant MIN_INCREMENT_PCT = 10;

    bytes32 internal constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant _MINT_TYPEHASH =
        keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");

    string internal constant GOBBLED_NAME = "Gobbled Warplets Fork";
    string internal constant GOBBLED_SYMBOL = "GWFORK";
    string internal constant GOBBLED_URI = "ipfs://gobbled-fork-test";

    uint256 internal constant SETTER_PK = 0xC0FFEE;

    address internal owner;
    address internal proceeds;
    address internal alice;
    address internal setter;

    IERC721 internal warplets;
    MockBidToken internal bidToken;
    AuctionSell internal sell;
    GobbledWarplets internal gobbled;
    NFTReserve internal reserve;

    uint256 internal warpletId;
    address internal originalHolder;

    bool internal forkCreated;
    bool internal ready;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", DEFAULT_BASE_RPC_URL);

        address warpletsAddr = vm.envOr("WARPLETS_NFT_ADDRESS", address(0));
        warpletId = vm.envOr("WARPLETS_FORK_TOKEN_ID", uint256(0));
        if (warpletsAddr == address(0) || warpletId == 0) {
            return;
        }

        uint256 pin = vm.envOr("WARPLETS_FORK_BLOCK", uint256(0));
        if (pin != 0) vm.createSelectFork(rpc, pin);
        else vm.createSelectFork(rpc);
        forkCreated = true;

        warplets = IERC721(warpletsAddr);
        // Resolve current holder of the chosen token id; required for the borrow-and-deposit step.
        originalHolder = warplets.ownerOf(warpletId);
        if (originalHolder == address(0)) {
            return;
        }

        owner = makeAddr("rescueForkOwner");
        proceeds = makeAddr("rescueForkProceeds");
        alice = makeAddr("rescueForkAlice");
        setter = vm.addr(SETTER_PK);

        vm.label(warpletsAddr, "Warplets");
        vm.label(originalHolder, "warpletHolder");

        vm.startPrank(owner);
        bidToken = new MockBidToken();
        reserve = new NFTReserve(warplets, owner);
        gobbled = new GobbledWarplets(GOBBLED_NAME, GOBBLED_SYMBOL, address(reserve), setter);
        reserve.setGobbledWarplets(gobbled);
        sell = new AuctionSell(
            warplets,
            bidToken,
            gobbled,
            proceeds,
            TIME_BUFFER,
            RESERVE_PRICE,
            MIN_INCREMENT_PCT,
            DURATION,
            owner,
            // No zap — this fork test only exercises the rescue flow, not native ETH bidding.
            address(0)
        );
        reserve.setAuction(address(sell));
        vm.stopPrank();

        // "Borrow" the warplet from its current owner and deposit into the auction queue.
        vm.prank(originalHolder);
        warplets.safeTransferFrom(originalHolder, address(reserve), warpletId);

        vm.prank(owner);
        sell.unpause();

        // Seed alice with bid tokens and approval.
        bidToken.mint(alice, RESERVE_PRICE * 10);
        vm.prank(alice);
        bidToken.approve(address(sell), type(uint256).max);

        ready = true;
    }

    modifier requiresIntegration() {
        if (!forkCreated || !ready) vm.skip(true);
        _;
    }

    function _aliceWinsAndSettles() internal {
        vm.prank(alice);
        sell.bid(RESERVE_PRICE);
        vm.warp(block.timestamp + DURATION + 1);
        sell.settleCurrentAndCreateNewAuction();

        // Settlement creates the receipt while the underlying Warplet remains in reserve custody.
        assertEq(warplets.ownerOf(warpletId), address(reserve));
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                _DOMAIN_TYPEHASH,
                keccak256(bytes(GOBBLED_NAME)),
                keccak256(bytes("1")),
                block.chainid,
                address(gobbled)
            )
        );
    }

    function _signMint(uint256 tokenId, string memory uri, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(_MINT_TYPEHASH, tokenId, keccak256(bytes(uri)), deadline));
        bytes32 digest = _domainSeparator().toTypedDataHash(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SETTER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    /* ========== variant 1: bare rescue ========== */

    function test_bare_rescue_pulls_real_warplet_to_winner() public requiresIntegration {
        _aliceWinsAndSettles();

        uint256 receiptId = warpletId; // first gobble of this warplet
        assertFalse(gobbled.warpletRescued(receiptId));

        vm.prank(alice);
        gobbled.rescueWarplet(receiptId);

        assertEq(warplets.ownerOf(warpletId), alice);
        assertTrue(gobbled.warpletRescued(receiptId));
        // Receipt was not minted.
        vm.expectRevert();
        gobbled.ownerOf(receiptId);
    }

    /* ========== variant 2: signed rescue (mints receipt + transfers warplet) ========== */

    function test_signed_rescue_mints_receipt_and_pulls_real_warplet() public requiresIntegration {
        _aliceWinsAndSettles();

        uint256 receiptId = warpletId;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signMint(receiptId, GOBBLED_URI, deadline);

        vm.prank(alice);
        gobbled.rescueWarplet(receiptId, GOBBLED_URI, deadline, sig);

        assertEq(warplets.ownerOf(warpletId), alice);
        assertEq(gobbled.ownerOf(receiptId), alice);
        assertEq(gobbled.tokenURI(receiptId), GOBBLED_URI);
        assertTrue(gobbled.warpletRescued(receiptId));
    }

    /* ========== sequence: bare rescue → signed rescue ========== */

    function test_signed_rescue_after_bare_rescue_only_mints_receipt() public requiresIntegration {
        _aliceWinsAndSettles();

        uint256 receiptId = warpletId;

        vm.prank(alice);
        gobbled.rescueWarplet(receiptId);
        assertEq(warplets.ownerOf(warpletId), alice);

        // Sign + complete the receipt. The signed overload must NOT attempt a second NFT transfer
        // (the auction no longer holds the warplet — alice does).
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signMint(receiptId, GOBBLED_URI, deadline);

        vm.prank(alice);
        gobbled.rescueWarplet(receiptId, GOBBLED_URI, deadline, sig);

        assertEq(gobbled.ownerOf(receiptId), alice);
        assertEq(gobbled.tokenURI(receiptId), GOBBLED_URI);
        // Still alice — the second call did not move the warplet.
        assertEq(warplets.ownerOf(warpletId), alice);
    }
}
