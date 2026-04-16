// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {GobbleSniper, PoolKey, Currency, BalanceDelta, IPoolManager} from "../src/GobbleSniper.sol";
import {DutchAuctionV2, IERC777Send} from "../src/DutchAuctionV2.sol";
import {IDutchAuction} from "../src/interfaces/IDutchAuction.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

// ═══════════════════════════════════════════════════════════════════════
//  Mocks
// ═══════════════════════════════════════════════════════════════════════

interface IERC777Recipient {
    function tokensReceived(
        address operator, address from, address to,
        uint256 amount, bytes calldata userData, bytes calldata operatorData
    ) external;
}

/// @dev Mock WARPGOBB with ERC-777 send behaviour.
contract MockWarpgobb is ERC20 {
    constructor() ERC20("Mock WARPGOBB", "WARPGOBB") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function send(address recipient_, uint256 amount, bytes calldata data) external {
        _transfer(msg.sender, recipient_, amount);
        if (recipient_.code.length > 0) {
            IERC777Recipient(recipient_).tokensReceived(msg.sender, msg.sender, recipient_, amount, data, "");
        }
    }
}

contract MockWarplets is ERC721 {
    constructor() ERC721("Mock Warplets", "WARPLET") {}
    function mint(address to, uint256 tokenId) external { _mint(to, tokenId); }
}

/// @dev nftReserve — accepts incoming Warplets.
contract MockNftReserve is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @dev Mock WETH: deposit wraps ETH, withdraw unwraps.
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}
    function deposit() external payable { _mint(msg.sender, msg.value); }
    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        (bool ok,) = msg.sender.call{value: wad}("");
        require(ok);
    }
    receive() external payable { _mint(msg.sender, msg.value); }
}

/// @dev Mock PoolManager. On unlock → calls unlockCallback. Swap exchanges
///      WARPGOBB for WETH at a fixed 2:1 rate (2 WARPGOBB = 1 WETH).
///      Expects the caller to sync+transfer+settle WARPGOBB and take WETH.
contract MockPoolManager {
    MockWarpgobb public warpgobb;
    MockWETH public weth;
    uint256 public rate; // WARPGOBB per 1 WETH (scaled 1e18)

    constructor(address _warpgobb, address payable _weth, uint256 _rate) {
        warpgobb = MockWarpgobb(_warpgobb);
        weth = MockWETH(_weth);
        rate = _rate;
    }

    function unlock(bytes calldata data) external returns (bytes memory) {
        // Call back into the caller (GobbleSniper)
        (bool ok, bytes memory ret) = msg.sender.call(
            abi.encodeWithSignature("unlockCallback(bytes)", data)
        );
        require(ok, string(ret));
        return ret;
    }

    function swap(PoolKey memory, IPoolManager.SwapParams memory params, bytes calldata)
        external returns (BalanceDelta)
    {
        // amountSpecified is negative for exact-input
        uint256 amountIn = uint256(-params.amountSpecified);
        uint256 amountOut = (amountIn * 1e18) / rate;

        // Encode BalanceDelta: amount0 in upper 128, amount1 in lower 128
        // Convention: positive = owed by caller, negative = owed to caller
        int128 amount0;
        int128 amount1;
        if (params.zeroForOne) {
            // Selling token0 (WARPGOBB): caller owes amount0, receives amount1
            amount0 = int128(int256(amountIn));
            amount1 = -int128(int256(amountOut));
        } else {
            amount0 = -int128(int256(amountOut));
            amount1 = int128(int256(amountIn));
        }
        return BalanceDelta.wrap((int256(amount0) << 128) | int256(int128(amount1)));
    }

    function sync(Currency) external {}

    function settle() external payable returns (uint256) {
        // The caller transferred WARPGOBB to us. Nothing else needed.
        return 0;
    }

    function take(Currency, address to, uint256 amount) external {
        // Mint WETH and send it to the caller
        weth.deposit{value: amount}();
        weth.transfer(to, amount);
    }

    receive() external payable {}
}

/// @dev Mock Seaport. When called with enough ETH, transfers the specified Warplet
///      to the caller. Simulates a successful Seaport NFT purchase.
contract MockSeaport {
    MockWarplets public warplets;
    // Set before each snipe
    uint256 public expectedTokenId;
    uint256 public price;
    address public nftHolder; // who currently holds the NFT

    constructor(address _warplets) { warplets = MockWarplets(_warplets); }

    function setListing(uint256 tokenId, uint256 price_, address holder) external {
        expectedTokenId = tokenId;
        price = price_;
        nftHolder = holder;
    }

    fallback() external payable {
        require(msg.value >= price, "MockSeaport: insufficient ETH");
        // Transfer NFT from holder to caller
        warplets.transferFrom(nftHolder, msg.sender, expectedTokenId);
        // Refund excess
        if (msg.value > price) {
            (bool ok,) = msg.sender.call{value: msg.value - price}("");
            require(ok);
        }
    }

    receive() external payable {}
}

// ═══════════════════════════════════════════════════════════════════════
//  Unit Tests
// ═══════════════════════════════════════════════════════════════════════

contract GobbleSniperTest is Test {
    MockWarplets internal warplets;
    MockWarpgobb internal warpgobb;
    MockWETH internal weth;
    MockNftReserve internal reserve;
    MockPoolManager internal poolManager;
    MockSeaport internal seaport;
    DutchAuctionV2 internal auction;
    GobbleSniper internal sniper;

    address internal recipientAddr = makeAddr("profitRecipient");
    address internal nftSeller = makeAddr("nftSeller");
    address internal anyoneCaller = makeAddr("anyone");
    address internal feeHandler = makeAddr("feeHandler");

    uint256 internal constant TOKEN_ID = 42;
    uint256 internal constant POT = 1_000e18;      // WARPGOBB in gobbler pot
    uint256 internal constant SWAP_RATE = 2e18;     // 2 WARPGOBB = 1 WETH
    uint256 internal constant NFT_PRICE = 0.1 ether;

    function setUp() public {
        warplets = new MockWarplets();
        warpgobb = new MockWarpgobb();
        weth = new MockWETH();
        reserve = new MockNftReserve();

        // Deploy auction
        auction = new DutchAuctionV2(
            address(warplets), address(warpgobb), address(reserve), feeHandler
        );

        // Fund the gobbler pot
        warpgobb.mint(address(auction), POT);

        // Deploy mock PoolManager with 2:1 rate → 1000 WARPGOBB = 500 WETH = 500 ETH
        poolManager = new MockPoolManager(address(warpgobb), payable(address(weth)), SWAP_RATE);
        // Fund the pool manager with ETH so it can mint WETH for swaps
        vm.deal(address(poolManager), 1000 ether);

        // Deploy mock Seaport
        seaport = new MockSeaport(address(warplets));

        // Mint a Warplet to nftSeller and list on mock Seaport
        warplets.mint(nftSeller, TOKEN_ID);
        vm.prank(nftSeller);
        warplets.approve(address(seaport), TOKEN_ID);
        seaport.setListing(TOKEN_ID, NFT_PRICE, nftSeller);

        // Build pool key — WARPGOBB and WETH, sorted by address
        Currency currency0;
        Currency currency1;
        if (address(warpgobb) < address(weth)) {
            currency0 = Currency.wrap(address(warpgobb));
            currency1 = Currency.wrap(address(weth));
        } else {
            currency0 = Currency.wrap(address(weth));
            currency1 = Currency.wrap(address(warpgobb));
        }
        PoolKey memory pk = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0)
        });

        // Deploy sniper
        sniper = new GobbleSniper(
            address(warplets),
            address(auction),
            address(warpgobb),
            address(weth),
            address(poolManager),
            address(seaport),
            pk,
            recipientAddr
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function _dummySeaportCalldata() internal pure returns (bytes memory) {
        // MockSeaport ignores calldata, just needs to be called with value
        return abi.encodeWithSignature("buy()");
    }

    // ── Happy path ──────────────────────────────────────────────────

    function test_snipe_full_flow() public {
        uint256 recipientBefore = recipientAddr.balance;

        vm.prank(anyoneCaller);
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), NFT_PRICE, 0, 0);

        // NFT ended up in reserve
        assertEq(warplets.ownerOf(TOKEN_ID), address(reserve));
        // Gobbler pot drained
        assertEq(auction.currentPrice(), 0);
        // Recipient received profit (500 ETH from swap - 0.1 ETH for NFT = ~499.9 ETH)
        uint256 profit = recipientAddr.balance - recipientBefore;
        assertGt(profit, 0, "recipient should have received profit");
        // Sniper contract should have 0 balance
        assertEq(address(sniper).balance, 0);
    }

    function test_snipe_emits_event_with_payout_and_profit() public {
        uint256 expectedSwapOut = (POT * 1e18) / SWAP_RATE;
        uint256 expectedProfit = expectedSwapOut - NFT_PRICE;

        // Check all fields including non-indexed (payout = POT, profit)
        vm.expectEmit(true, false, false, true, address(sniper));
        emit GobbleSniper.Sniped(TOKEN_ID, POT, expectedProfit);

        vm.prank(anyoneCaller);
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), NFT_PRICE, 0, 0);
    }

    function test_snipe_anyone_can_call() public {
        address randomCaller = makeAddr("random");
        uint256 recipientBefore = recipientAddr.balance;

        vm.prank(randomCaller);
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), NFT_PRICE, 0, 0);

        assertGt(recipientAddr.balance - recipientBefore, 0);
    }

    function test_snipe_profits_go_to_recipient_not_caller() public {
        address randomCaller = makeAddr("random");
        uint256 callerBefore = randomCaller.balance;
        uint256 recipientBefore = recipientAddr.balance;

        vm.prank(randomCaller);
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), NFT_PRICE, 0, 0);

        // Caller balance unchanged
        assertEq(randomCaller.balance, callerBefore);
        // Recipient got the profit
        assertGt(recipientAddr.balance, recipientBefore);
    }

    // ── Profit threshold ────────────────────────────────────────────

    function test_snipe_reverts_below_min_profit() public {
        // Swap gives 500 ETH, NFT costs 0.1 ETH, profit ≈ 499.9 ETH
        // Require more than that → should revert
        vm.prank(anyoneCaller);
        vm.expectRevert("Not profitable");
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), NFT_PRICE, 0, 600 ether);
    }

    function test_snipe_succeeds_at_exact_min_profit() public {
        // Expected profit ≈ 500 ETH - 0.1 ETH = 499.9 ETH
        uint256 expectedSwapOut = (POT * 1e18) / SWAP_RATE; // 500 ETH
        uint256 expectedProfit = expectedSwapOut - NFT_PRICE;

        vm.prank(anyoneCaller);
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), NFT_PRICE, 0, expectedProfit);
    }

    // ── Seaport failures ────────────────────────────────────────────

    function test_snipe_reverts_if_nft_price_too_high() public {
        // Set NFT price higher than swap output (500 ETH)
        seaport.setListing(TOKEN_ID, 600 ether, nftSeller);

        vm.prank(anyoneCaller);
        vm.expectRevert(); // insufficient ETH in callback
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), 600 ether, 0, 0);
    }

    // ── Empty pot ───────────────────────────────────────────────────

    function test_snipe_with_empty_pot_reverts() public {
        // Deploy auction with no pot
        DutchAuctionV2 emptyAuction = new DutchAuctionV2(
            address(warplets), address(warpgobb), address(reserve), feeHandler
        );

        // Need fresh warplet + listing
        uint256 freshId = 99;
        warplets.mint(nftSeller, freshId);
        vm.prank(nftSeller);
        warplets.approve(address(seaport), freshId);
        seaport.setListing(freshId, NFT_PRICE, nftSeller);

        // Build fresh sniper pointing to empty auction
        Currency c0;
        Currency c1;
        if (address(warpgobb) < address(weth)) {
            c0 = Currency.wrap(address(warpgobb));
            c1 = Currency.wrap(address(weth));
        } else {
            c0 = Currency.wrap(address(weth));
            c1 = Currency.wrap(address(warpgobb));
        }
        PoolKey memory pk = PoolKey({ currency0: c0, currency1: c1, fee: 3000, tickSpacing: 60, hooks: address(0) });

        GobbleSniper emptySniper = new GobbleSniper(
            address(warplets), address(emptyAuction), address(warpgobb),
            address(weth), address(poolManager), address(seaport), pk, recipientAddr
        );

        // Pot is 0 → swap returns 0 → can't buy NFT → reverts
        vm.prank(anyoneCaller);
        vm.expectRevert();
        emptySniper.snipe(freshId, _dummySeaportCalldata(), NFT_PRICE, 0, 0);
    }

    // ── Admin: withdraw ─────────────────────────────────────────────

    function test_withdraw_sends_eth_to_recipient() public {
        vm.deal(address(sniper), 1 ether);
        uint256 before = recipientAddr.balance;

        vm.prank(anyoneCaller); // permissionless
        sniper.withdraw();

        assertEq(recipientAddr.balance - before, 1 ether);
        assertEq(address(sniper).balance, 0);
    }

    function test_withdrawToken_sends_to_recipient() public {
        warpgobb.mint(address(sniper), 100e18);
        uint256 before = warpgobb.balanceOf(recipientAddr);

        vm.prank(anyoneCaller);
        sniper.withdrawToken(address(warpgobb));

        assertEq(warpgobb.balanceOf(recipientAddr) - before, 100e18);
        assertEq(warpgobb.balanceOf(address(sniper)), 0);
    }

    // ── Recipient immutable ─────────────────────────────────────────

    function test_recipient_is_set_correctly() public view {
        assertEq(sniper.recipient(), recipientAddr);
    }

    function test_recipient_defaults_to_deployer_when_zero() public {
        Currency c0;
        Currency c1;
        if (address(warpgobb) < address(weth)) {
            c0 = Currency.wrap(address(warpgobb));
            c1 = Currency.wrap(address(weth));
        } else {
            c0 = Currency.wrap(address(weth));
            c1 = Currency.wrap(address(warpgobb));
        }
        PoolKey memory pk = PoolKey({ currency0: c0, currency1: c1, fee: 3000, tickSpacing: 60, hooks: address(0) });

        address deployer = makeAddr("deployer");
        vm.prank(deployer);
        GobbleSniper s = new GobbleSniper(
            address(warplets), address(auction), address(warpgobb),
            address(weth), address(poolManager), address(seaport), pk, address(0)
        );
        assertEq(s.recipient(), deployer);
    }

    // ── tokensReceived defense-in-depth checks ──────────────────────

    function test_tokensReceived_reverts_when_caller_is_not_warpgobb() public {
        // Random EOA/contract calling tokensReceived directly
        address impostor = makeAddr("impostor");
        vm.prank(impostor);
        vm.expectRevert("not warpgobb");
        sniper.tokensReceived(address(0), address(auction), address(0), 0, abi.encode(uint256(1)), "");
    }

    function test_tokensReceived_reverts_when_from_is_not_gobbler() public {
        // WARPGOBB calls the callback but `from` is not our gobbler
        vm.prank(address(warpgobb));
        vm.expectRevert("not from gobbler");
        sniper.tokensReceived(address(0), address(0xbad), address(0), 0, abi.encode(uint256(1)), "");
    }

    function test_tokensReceived_reverts_outside_snipe() public {
        // Correct caller + from, but no active snipe
        vm.prank(address(warpgobb));
        vm.expectRevert("not in snipe");
        sniper.tokensReceived(address(0), address(auction), address(0), 0, abi.encode(uint256(1)), "");
    }

    // ── minGobblePayout forwarded to gobbleFlash ─────────────────────

    function test_snipe_reverts_when_minGobblePayout_above_pot() public {
        // Pot = POT. Require more than that → gobbleFlash reverts internally.
        vm.prank(anyoneCaller);
        vm.expectRevert("Price is too low, try again later");
        sniper.snipe(TOKEN_ID, _dummySeaportCalldata(), NFT_PRICE, POT + 1, 0);
    }
}
