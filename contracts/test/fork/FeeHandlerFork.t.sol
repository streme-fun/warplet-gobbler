// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FeeHandler} from "../../src/FeeHandler.sol";
import {DutchAuction} from "../../src/DutchAuction.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev Minimal collection so `DutchAuction` can be constructed on the fork (gobble is unused here).
contract ForkWarplet721 is ERC721 {
    constructor() ERC721("ForkWarplet", "FWP") {}
}

/// @notice Fork tests against Base mainnet: real `ISuperToken` (streme) from env; auction is deployed locally.
/// @dev Copy `.env.example` → `contracts/.env` and set `BASE_RPC_URL`, `FEE_HANDLER_FORK_STREME` (and optionally others).
///      `FEE_HANDLER_FORK_STREME` must be a **Superfluid Super Token** already deployed on the forked chain
///      (the same asset `FeeHandler` streams via `ISuperToken.flow`). Plain ERC-20s will not work.
///      Integration tests skip when env is incomplete (`vm.skip`).
///
///      `lpFactory` / `stremeZap` default to bare EOAs when unset: `claimRewards` is a no-op success,
///      and with zero cash balance the swap path is skipped — enough to exercise access control
///      and flow updates against a real SuperToken.
contract FeeHandlerForkTest is Test {
    /// @notice Native Base USDC (6 decimals).
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    uint256 internal constant TARGET_DURATION = 7 days;
    uint256 internal constant MIN_TOKEN_OUT = 0;

    /// @dev Burn address with no stream / balance; `FeeHandler` is deployed against this, then `setAuction` migrates to `DutchAuction`.
    address internal constant PLACEHOLDER_AUCTION = 0x000000000000000000000000000000000000dEaD;

    FeeHandler internal handler;

    address internal admin;
    address internal rebalancer;
    address internal stranger;

    address internal cash;
    address internal streme;
    address internal lpFactory;
    address internal auction;
    address internal stremeZap;

    bool internal forkCreated;
    bool internal ready;

    /// @dev Load fork + deploy; mark `ready` when we can run integration tests.
    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            forkCreated = false;
            ready = false;
            return;
        }

        uint256 pin = vm.envOr("FEE_HANDLER_FORK_BLOCK", uint256(0));
        if (pin != 0) vm.createSelectFork(rpc, pin);
        else vm.createSelectFork(rpc);

        forkCreated = true;

        streme = vm.envOr("FEE_HANDLER_FORK_STREME", address(0));
        if (streme == address(0)) {
            ready = false;
            return;
        }

        cash = vm.envOr("FEE_HANDLER_FORK_CASH", USDC_BASE);

        admin = makeAddr("feeHandlerForkAdmin");
        rebalancer = makeAddr("feeHandlerForkRebalancer");
        stranger = makeAddr("feeHandlerForkStranger");
        lpFactory = vm.envOr("FEE_HANDLER_FORK_LP_FACTORY", makeAddr("feeHandlerForkLpNoop"));
        stremeZap = vm.envOr("FEE_HANDLER_FORK_STREME_ZAP", makeAddr("feeHandlerForkZapNoop"));

        vm.label(admin, "admin");
        vm.label(rebalancer, "rebalancer");
        vm.label(stranger, "stranger");
        vm.label(streme, "stremeSuperToken");
        vm.label(cash, "cash");
        vm.label(lpFactory, "lpFactory");
        vm.label(stremeZap, "stremeZap");
        vm.label(PLACEHOLDER_AUCTION, "placeholderAuction");

        ForkWarplet721 warplets = new ForkWarplet721();
        vm.label(address(warplets), "warplets");
        address nftReserve = makeAddr("feeHandlerForkNftReserve");

        handler = new FeeHandler(
            cash,
            streme,
            lpFactory,
            PLACEHOLDER_AUCTION,
            stremeZap,
            TARGET_DURATION,
            admin,
            rebalancer,
            MIN_TOKEN_OUT
        );

        vm.label(address(handler), "FeeHandler");

        DutchAuction dutch = new DutchAuction(address(warplets), streme, nftReserve, address(handler));
        auction = address(dutch);
        vm.label(auction, "auction");

        vm.startPrank(admin);
        handler.setAuction(auction);
        handler.startStream();
        vm.stopPrank();

        ready = true;
    }

    modifier requiresFork() {
        if (!forkCreated) vm.skip(true);
        _;
    }

    modifier requiresIntegration() {
        if (!forkCreated) vm.skip(true);
        if (!ready) vm.skip(true);
        _;
    }

    function test_fork_skippedWithoutRpc() public {
        if (forkCreated) vm.skip(true);
        assertTrue(bytes(vm.envOr("BASE_RPC_URL", string(""))).length == 0, "set BASE_RPC_URL to run fork tests");
    }

    function test_roles_grantedOnDeploy() public requiresIntegration {
        bytes32 adminRole = handler.DEFAULT_ADMIN_ROLE();
        bytes32 rebalancerRole = handler.REBALANCER_ROLE();

        assertTrue(handler.hasRole(adminRole, admin));
        assertTrue(handler.hasRole(rebalancerRole, rebalancer));
        assertFalse(handler.hasRole(rebalancerRole, stranger));
    }

    function test_stranger_cannot_rebalance() public requiresIntegration {
        vm.prank(stranger);
        vm.expectRevert(FeeHandler.UnauthorizedRebalance.selector);
        handler.rebalance();
    }

    function test_rebalancer_can_rebalance() public requiresIntegration {
        vm.prank(rebalancer);
        handler.rebalance();
    }

    function test_admin_can_rebalance() public requiresIntegration {
        vm.prank(admin);
        handler.rebalance();
    }

    /// @notice `rebalanceFlowRate` is permissionless when stream is active (current contract behavior).
    function test_anyone_can_rebalanceFlowRate_whenActive() public requiresIntegration {
        assertTrue(handler.streamActive());
        vm.prank(stranger);
        handler.rebalanceFlowRate();
    }

    function test_stranger_cannot_setTargetDuration() public requiresIntegration {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, handler.DEFAULT_ADMIN_ROLE())
        );
        handler.setTargetDuration(TARGET_DURATION + 1);
    }

    function test_admin_setTargetDuration_updatesState() public requiresIntegration {
        uint256 newDur = TARGET_DURATION * 2;
        vm.prank(admin);
        handler.setTargetDuration(newDur);
        assertEq(handler.targetDuration(), newDur);
    }

    /// @notice Uses Foundry `deal` on fork state — real SuperToken balance field updated.
    function test_previewFlowRate_matches_balance_over_duration() public requiresIntegration {
        uint256 amount = 1_000 ether;
        deal(streme, address(handler), amount);

        int96 expected = int96(int256(amount / TARGET_DURATION));
        assertEq(handler.previewFlowRate(), expected);
    }
}
