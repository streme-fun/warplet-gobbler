// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionSell} from "../../src/AuctionSell.sol";
import {GobbledWarplets} from "../../src/GobbledWarplets.sol";
import {MockAuctionNFT} from "../mocks/MockAuctionNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC777Like {
    function send(address recipient, uint256 amount, bytes calldata data) external;
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Fork test: verifies bids can be placed via ERC777 `send` + `tokensReceived` using a real SuperToken.
/// @dev Requires `BASE_RPC_URL` and a real SuperToken address in `AUCTION_SELL_FORK_BID_TOKEN`
///      (falls back to `FEE_HANDLER_FORK_STREME` for convenience).
contract AuctionSellForkTest is Test {
    string internal constant DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
    address internal constant UNISWAP_SINGLETON = 0x498581fF718922c3f8e6A244956aF099B2652b2b;

    /// @notice Native Streme SuperToken on Base used as default for fork tests.
    address internal constant STREME_SUPERTOKEN_BASE = 0x3042b035325393F3d72390C7E5d51F26fe1F0e61;

    uint256 internal constant DURATION = 24 hours;
    uint256 internal constant TIME_BUFFER = 5 minutes;
    uint256 internal constant RESERVE_PRICE = 1e18;
    uint8 internal constant MIN_INCREMENT_PCT = 10;

    address internal owner;
    address internal proceeds;
    address internal alice;
    address internal bob;

    address internal bidTokenAddr;
    AuctionSell internal sell;
    GobbledWarplets internal gobbled;
    MockAuctionNFT internal nft;

    bool internal forkCreated;
    bool internal ready;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", DEFAULT_BASE_RPC_URL);

        uint256 pin = vm.envOr("AUCTION_SELL_FORK_BLOCK", uint256(0));
        if (pin != 0) vm.createSelectFork(rpc, pin);
        else vm.createSelectFork(rpc);
        forkCreated = true;

        bidTokenAddr = vm.envOr("AUCTION_SELL_FORK_BID_TOKEN", STREME_SUPERTOKEN_BASE);
        if (bidTokenAddr == address(0)) {
            bidTokenAddr = vm.envOr("FEE_HANDLER_FORK_STREME", STREME_SUPERTOKEN_BASE);
        }
        if (bidTokenAddr == address(0)) {
            ready = false;
            return;
        }

        owner = makeAddr("auctionSellForkOwner");
        proceeds = makeAddr("auctionSellForkProceeds");
        alice = makeAddr("auctionSellForkAlice");
        bob = makeAddr("auctionSellForkBob");

        vm.label(bidTokenAddr, "forkSuperToken");
        vm.label(owner, "owner");
        vm.label(proceeds, "proceeds");
        vm.label(alice, "alice");
        vm.label(bob, "bob");

        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        gobbled = new GobbledWarplets("Gobbled Warplets", "GOBBLED", owner, owner);
        sell = new AuctionSell(
            nft,
            IERC20(bidTokenAddr),
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

        vm.label(address(sell), "AuctionSell");
        vm.label(address(nft), "MockAuctionNFT");
        vm.label(address(gobbled), "GobbledWarplets");

        vm.startPrank(owner);
        uint256 tokenId = nft.mint(owner);
        nft.safeTransferFrom(owner, address(sell), tokenId);
        sell.unpause();
        vm.stopPrank();

        ready = true;
    }

    modifier requiresIntegration() {
        if (!forkCreated) vm.skip(true);
        if (!ready) vm.skip(true);
        _;
    }

    function test_tokensReceived_bid_via_real_supertoken_send() public requiresIntegration {
        uint256 aliceBid = RESERVE_PRICE;
        uint256 bobBid = aliceBid + ((aliceBid * MIN_INCREMENT_PCT) / 100);
        uint256 seed = aliceBid + bobBid;

        _stealTokensFromSingleton(bidTokenAddr, alice, seed);
        _stealTokensFromSingleton(bidTokenAddr, bob, seed);

        uint256 aliceStart = IERC777Like(bidTokenAddr).balanceOf(alice);
        uint256 bobStart = IERC777Like(bidTokenAddr).balanceOf(bob);
        uint256 proceedsStart = IERC777Like(bidTokenAddr).balanceOf(proceeds);

        vm.prank(alice);
        IERC777Like(bidTokenAddr).send(address(sell), aliceBid, "");

        (, address highBidder1, uint256 highBid1,) = sell.currentAuction();
        assertEq(highBidder1, alice);
        assertEq(highBid1, aliceBid);
        assertEq(IERC777Like(bidTokenAddr).balanceOf(alice), aliceStart - aliceBid);
        assertEq(IERC777Like(bidTokenAddr).balanceOf(address(sell)), aliceBid);

        vm.prank(bob);
        IERC777Like(bidTokenAddr).send(address(sell), bobBid, "");

        (, address highBidder2, uint256 highBid2,) = sell.currentAuction();
        assertEq(highBidder2, bob);
        assertEq(highBid2, bobBid);
        assertEq(IERC777Like(bidTokenAddr).balanceOf(alice), aliceStart);
        assertEq(IERC777Like(bidTokenAddr).balanceOf(bob), bobStart - bobBid);
        assertEq(IERC777Like(bidTokenAddr).balanceOf(address(sell)), bobBid);
        assertEq(IERC777Like(bidTokenAddr).balanceOf(proceeds), proceedsStart);
    }

    function _stealTokensFromSingleton(address token, address to, uint256 amount) internal {
        uint256 bal = IERC777Like(token).balanceOf(UNISWAP_SINGLETON);
        require(bal >= amount, "fork: singleton insufficient token");

        vm.prank(UNISWAP_SINGLETON);
        bool ok = IERC20(token).transfer(to, amount);
        require(ok, "fork: singleton transfer failed");
    }
}
