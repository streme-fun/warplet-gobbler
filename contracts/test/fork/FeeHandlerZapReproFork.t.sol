// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FeeHandler} from "../../src/FeeHandler.sol";
import {DutchAuction} from "../../src/DutchAuction.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ZapReproWarplet is ERC721 {
    constructor() ERC721("ZapReproWarplet", "ZRW") {}
}

contract NoopLPForZapFork {
    function claimRewards(address) external {}
}

/// @notice Base fork: real StremeZapUniversal on the WETH→Streme swap path (not a noop zap).
/// @dev Passing `address(this)` as zap’s `stakingContract` made the zap call `FeeHandler.stake` and revert.
///      FeeHandler must pass `address(0)` so the zap sends output to `msg.sender`.
///      Uses `BASE_RPC_URL` when set, otherwise `https://mainnet.base.org`.
contract FeeHandlerZapReproForkTest is Test {
    address internal constant WETH_BASE = 0x4200000000000000000000000000000000000006;
    address internal constant STREME_SUPERTOKEN = 0x3042b035325393F3d72390C7E5d51F26fe1F0e61;
    address internal constant STREME_ZAP_UNIVERSAL = 0xEe3f62CF6987121f9cBe567C0E5a01c940A7e570;
    address internal constant PLACEHOLDER_AUCTION = 0x000000000000000000000000000000000000dEaD;

    uint256 internal constant TARGET_DURATION = 7 days;
    uint256 internal constant DEAL_WETH = 0.02 ether;

    FeeHandler internal handler;
    address internal admin = makeAddr("zapForkAdmin");
    address internal rebalancer = makeAddr("zapForkRebalancer");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org"));
        vm.createSelectFork(rpc);

        NoopLPForZapFork noopLp = new NoopLPForZapFork();

        handler = new FeeHandler(
            WETH_BASE,
            STREME_SUPERTOKEN,
            address(noopLp),
            PLACEHOLDER_AUCTION,
            STREME_ZAP_UNIVERSAL,
            TARGET_DURATION,
            admin,
            rebalancer
        );

        ZapReproWarplet warplets = new ZapReproWarplet();
        address nftReserve = makeAddr("zapForkNftReserve");
        DutchAuction dutch = new DutchAuction(address(warplets), STREME_SUPERTOKEN, nftReserve, address(handler));

        vm.startPrank(admin);
        handler.setAuction(address(dutch));
        handler.startStream();
        vm.stopPrank();

        deal(WETH_BASE, address(handler), DEAL_WETH);
    }

    function testFork_rebalance_withRealStremeZap_completes() public {
        uint256 stremeBefore = IERC20(STREME_SUPERTOKEN).balanceOf(address(handler));
        uint256 wethBefore = IERC20(WETH_BASE).balanceOf(address(handler));

        vm.prank(rebalancer);
        handler.rebalance(0);

        assertLt(IERC20(WETH_BASE).balanceOf(address(handler)), wethBefore, "weth should decrease from swap");
        assertGt(IERC20(STREME_SUPERTOKEN).balanceOf(address(handler)), stremeBefore, "streme should increase from swap");
    }
}
