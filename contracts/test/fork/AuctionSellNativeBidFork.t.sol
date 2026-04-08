// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionSell, IStremeZapUniversal} from "../../src/AuctionSell.sol";
import {GobbledWarplets} from "../../src/GobbledWarplets.sol";
import {MockAuctionNFT} from "../mocks/MockAuctionNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Base mainnet fork: ETH `bid` path hits **production** `StremeZapUniversal` and real Streme SuperToken.
/// @dev Same zap + token addresses as `FeeHandlerZapReproForkTest`. Requires network (or `BASE_RPC_URL`).
///
///      Env overrides (optional):
///      - `AUCTION_SELL_FORK_RESERVE_WEI` — must be achievable from `AUCTION_SELL_FORK_ETH_BID` at fork time.
///      - `AUCTION_SELL_FORK_ETH_BID` — native ETH attached to `bid`.
///      - `AUCTION_SELL_FORK_BLOCK` — pin block for reproducibility.
///      - `AUCTION_SELL_FORK_STREME_ZAP` — override zap (defaults to `FeeHandlerZapReproForkTest` address).
contract AuctionSellNativeBidForkTest is Test {
    address internal constant STREME_SUPERTOKEN = 0x3042b035325393F3d72390C7E5d51F26fe1F0e61;
    address internal constant STREME_ZAP_UNIVERSAL_DEFAULT = 0xEe3f62CF6987121f9cBe567C0E5a01c940A7e570;

    address internal stremeZapAddr;

    uint256 internal constant DURATION = 24 hours;
    uint256 internal constant TIME_BUFFER = 5 minutes;
    uint8 internal constant MIN_INCREMENT_PCT = 10;

    AuctionSell internal sell;
    GobbledWarplets internal gobbled;
    MockAuctionNFT internal nft;

    address internal owner;
    address internal proceeds;
    address internal alice;

    uint256 internal reservePrice;
    uint256 internal ethBid;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org"));
        uint256 pin = vm.envOr("AUCTION_SELL_FORK_BLOCK", uint256(0));
        if (pin != 0) vm.createSelectFork(rpc, pin);
        else vm.createSelectFork(rpc);

        owner = makeAddr("nativeBidFork_owner");
        proceeds = makeAddr("nativeBidFork_proceeds");
        alice = makeAddr("nativeBidFork_alice");

        reservePrice = vm.envOr("AUCTION_SELL_FORK_RESERVE_WEI", uint256(1 ether));
        ethBid = vm.envOr("AUCTION_SELL_FORK_ETH_BID", uint256(0.05 ether));
        stremeZapAddr = vm.envOr("AUCTION_SELL_FORK_STREME_ZAP", STREME_ZAP_UNIVERSAL_DEFAULT);

        vm.label(STREME_SUPERTOKEN, "STREME");
        vm.label(stremeZapAddr, "StremeZapUniversal");

        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        gobbled = new GobbledWarplets("Gobbled Warplets", "GOBBLED", owner);
        sell = new AuctionSell(
            nft,
            IERC20(STREME_SUPERTOKEN),
            gobbled,
            proceeds,
            TIME_BUFFER,
            reservePrice,
            MIN_INCREMENT_PCT,
            DURATION,
            owner,
            stremeZapAddr
        );
        gobbled.setMinter(address(sell));

        uint256 tid = nft.mint(owner);
        nft.safeTransferFrom(owner, address(sell), tid);
        sell.unpause();
        vm.stopPrank();
    }

    /// @notice Sanity: direct zap call matches `AuctionSell` argument shape (`amountIn == msg.value`, `amountOutMin`).
    function testFork_zap_direct_ETH_matches_auctionSell_calldata_shape() public {
        uint256 snapshot = vm.snapshotState();

        address receiver = makeAddr("zap_receiver");
        uint256 minOut = reservePrice / 2;

        deal(receiver, ethBid + 1 ether);
        uint256 balBefore = IERC20(STREME_SUPERTOKEN).balanceOf(receiver);

        vm.prank(receiver);
        uint256 out = IStremeZapUniversal(stremeZapAddr).zap{value: ethBid}(
            STREME_SUPERTOKEN,
            ethBid,
            minOut,
            address(0)
        );

        assertGe(out, minOut, "zap returned amount");
        assertEq(IERC20(STREME_SUPERTOKEN).balanceOf(receiver) - balBefore, out, "balance delta == returned out");

        vm.revertToState(snapshot);
    }

    function testFork_bidWithEth_realStremeZap_escrows_reserve_to_auction() public {
        deal(alice, ethBid + 2 ether);

        uint256 stremeSellBefore = IERC20(STREME_SUPERTOKEN).balanceOf(address(sell));
        uint256 aliceEthBefore = alice.balance;

        vm.prank(alice);
        sell.bid{value: ethBid}(reservePrice);

        (, address highBidder, uint256 highBid,) = sell.currentAuction();
        assertEq(highBidder, alice, "high bidder");
        assertEq(highBid, reservePrice, "high bid == arg");

        uint256 stremeSellAfter = IERC20(STREME_SUPERTOKEN).balanceOf(address(sell));
        assertEq(stremeSellAfter - stremeSellBefore, reservePrice, "auction escrow = bid size (refunded dust)");

        assertLt(alice.balance, aliceEthBefore, "spent ETH");
    }

    /// @notice If the pool cannot deliver `amountOutMin` for the given ETH, the tx must revert (zap or auction guard).
    function testFork_bidWithEth_reverts_when_minOut_impossible() public {
        uint256 snapshot = vm.snapshotState();

        uint256 impossibleMin = type(uint128).max;
        deal(alice, ethBid + 2 ether);

        vm.prank(alice);
        vm.expectRevert();
        sell.bid{value: ethBid}(impossibleMin);

        vm.revertToState(snapshot);
    }
}
