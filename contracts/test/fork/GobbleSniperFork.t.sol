// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {GobbleSniper, PoolKey, Currency} from "../../src/GobbleSniper.sol";
import {DutchAuctionV2, IERC777Send} from "../../src/DutchAuctionV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @dev Minimal nftReserve that accepts any Warplet.
contract ForkNftReserve is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @dev Mock Seaport for fork test: transfers a specific Warplet for ETH.
contract MockForkSeaport {
    address public warplets;
    uint256 public tokenId;
    address public nftOwner;
    uint256 public price;

    constructor(address _warplets, uint256 _tokenId, address _owner) {
        warplets = _warplets;
        tokenId = _tokenId;
        nftOwner = _owner;
    }

    function setPrice(uint256 p) external { price = p; }

    fallback() external payable {
        require(msg.value >= price, "MockForkSeaport: not enough ETH");
        IERC721(warplets).transferFrom(nftOwner, msg.sender, tokenId);
        if (msg.value > price) {
            (bool ok,) = msg.sender.call{value: msg.value - price}("");
            require(ok);
        }
    }

    receive() external payable {}
}

/// @notice Base mainnet fork test: exercises the REAL deployed contracts.
///         Tests each step of the flash-gobble arb in isolation AND the full flow.
contract GobbleSniperForkTest is Test {
    // ── Real Base addresses ──────────────────────────────────────────
    address internal constant WARPLETS     = 0x699727F9E01A822EFdcf7333073f0461e5914b4E;
    address internal constant WARPGOBB     = 0x3042b035325393F3d72390C7E5d51F26fe1F0e61;
    address internal constant WETH         = 0x4200000000000000000000000000000000000006;
    address internal constant POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address internal constant STATE_VIEW   = 0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71;
    address internal constant SEAPORT      = 0x0000000000000068F116a894984e2DB1123eB395;
    address internal constant ERC1820      = 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;

    // Pool params found by brute force: fee=100000, tickSpacing=2000, hooks=address(0)
    uint24 internal constant POOL_FEE = 100000;
    int24 internal constant POOL_TICK_SPACING = 2000;
    address internal constant POOL_HOOKS = address(0);

    bytes32 internal constant POOL_ID = 0xEA059641F611A37DCA1235BCA9A75205590E9A74C69C95C008C458C7731A9488;

    // ── State ────────────────────────────────────────────────────────
    DutchAuctionV2 internal auction;
    ForkNftReserve internal reserve;
    GobbleSniper internal sniper;

    address internal recipient = makeAddr("forkRecipient");
    address internal feeHandler = makeAddr("forkFeeHandler");
    address internal caller = makeAddr("forkCaller");

    function _fork() internal {
        string memory rpc = vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org"));
        vm.createSelectFork(rpc);
    }

    function _poolKey() internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(WARPGOBB < WETH ? WARPGOBB : WETH),
            currency1: Currency.wrap(WARPGOBB < WETH ? WETH : WARPGOBB),
            fee: POOL_FEE,
            tickSpacing: POOL_TICK_SPACING,
            hooks: POOL_HOOKS
        });
    }

    function _deployFresh() internal {
        reserve = new ForkNftReserve();
        auction = new DutchAuctionV2(WARPLETS, WARPGOBB, address(reserve), feeHandler);
        sniper = new GobbleSniper(
            WARPLETS, address(auction), WARPGOBB, WETH,
            POOL_MANAGER, SEAPORT, _poolKey(), recipient
        );
    }

    /// @dev Transfer WARPGOBB to `to` from the live DutchAuction which holds the Superfluid stream pot.
    function _fundWithWarpgobb(address to, uint256 amount) internal returns (bool) {
        // Try the live DutchAuction first, then FeeHandler
        address[2] memory holders = [
            0xD3598909A51Ac1227D8EFa240A216A61a43c8344, // live DutchAuctionV2
            0xb8B8D10485f01A2C4457cE9f4a5eb65C6E46d73C  // FeeHandler
        ];
        for (uint256 i; i < holders.length; i++) {
            uint256 bal = IERC20(WARPGOBB).balanceOf(holders[i]);
            if (bal >= amount) {
                vm.prank(holders[i]);
                IERC20(WARPGOBB).transfer(to, amount);
                return true;
            }
        }
        return false;
    }

    // ═════════════════════════════════════════════════════════════════
    //  Step 1: Verify pool key matches the actual V4 pool
    // ═════════════════════════════════════════════════════════════════

    function test_fork_pool_key_matches_pool_id() public {
        _fork();
        // Compute pool ID from our params and verify it matches the known one
        bytes32 computedId = keccak256(abi.encode(_poolKey()));
        assertEq(computedId, POOL_ID, "Pool key does not match POOL_ID");
    }

    function test_fork_pool_has_liquidity() public {
        _fork();
        (bool ok, bytes memory data) = STATE_VIEW.staticcall(
            abi.encodeWithSignature("getSlot0(bytes32)", POOL_ID)
        );
        require(ok, "StateView call failed");
        (uint160 sqrtPriceX96,,,) = abi.decode(data, (uint160, int24, uint24, uint24));
        assertGt(sqrtPriceX96, 0, "Pool has zero price");
        console2.log("sqrtPriceX96:", sqrtPriceX96);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Step 2: ERC-1820 registration works in fresh deploy
    // ═════════════════════════════════════════════════════════════════

    function test_fork_fresh_sniper_is_erc1820_registered() public {
        _fork();
        _deployFresh();
        (bool ok, bytes memory data) = ERC1820.staticcall(
            abi.encodeWithSignature(
                "getInterfaceImplementer(address,bytes32)",
                address(sniper),
                keccak256("ERC777TokensRecipient")
            )
        );
        require(ok, "ERC1820 call failed");
        address impl = abi.decode(data, (address));
        assertEq(impl, address(sniper), "Sniper not registered as ERC777 recipient");
    }

    // ═════════════════════════════════════════════════════════════════
    //  Step 3: DutchAuctionV2 can send() WARPGOBB to the sniper
    // ═════════════════════════════════════════════════════════════════

    function test_fork_gobbleFlash_sends_warpgobb_to_sniper() public {
        _fork();
        _deployFresh();

        // Fund the auction pot
        uint256 pot = 100e18;
        bool funded = _fundWithWarpgobb(address(auction), pot);
        if (!funded) { console2.log("SKIP: no WARPGOBB available on-chain"); return; }

        // We need a Warplet to gobble. Find token #1 and give it to the sniper.
        uint256 tokenId = 1;
        address nftOwner = IERC721(WARPLETS).ownerOf(tokenId);

        // Deploy a hook that just delivers the NFT (not the full sniper — just testing gobbleFlash)
        SimpleDeliverHook hook = new SimpleDeliverHook(WARPLETS, address(reserve));
        vm.prank(nftOwner);
        IERC721(WARPLETS).safeTransferFrom(nftOwner, address(hook), tokenId);

        // Register hook as ERC-777 recipient
        vm.prank(address(hook));
        (bool ok,) = ERC1820.call(
            abi.encodeWithSignature(
                "setInterfaceImplementer(address,bytes32,address)",
                address(hook), keccak256("ERC777TokensRecipient"), address(hook)
            )
        );
        require(ok, "ERC1820 registration failed");

        uint256 hookBefore = IERC20(WARPGOBB).balanceOf(address(hook));
        vm.prank(address(hook));
        auction.gobbleFlash(tokenId, 0);

        assertEq(IERC721(WARPLETS).ownerOf(tokenId), address(reserve), "NFT not in reserve");
        uint256 payout = IERC20(WARPGOBB).balanceOf(address(hook)) - hookBefore;
        assertGt(payout, 0, "Hook received no WARPGOBB");
        console2.log("Payout:", payout);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Step 4: V4 swap works (WARPGOBB → WETH)
    // ═════════════════════════════════════════════════════════════════

    function test_fork_v4_swap_warpgobb_for_weth() public {
        _fork();
        _deployFresh();

        // Fund sniper with WARPGOBB
        uint256 amountIn = 100e18;
        bool funded = _fundWithWarpgobb(address(sniper), amountIn);
        if (!funded) { console2.log("SKIP: no WARPGOBB available"); return; }

        uint256 wethBefore = IERC20(WETH).balanceOf(address(sniper));

        // Call the swap directly by impersonating the sniper calling itself
        // We can't call _swapExactInput (internal), so we test via gobbleFlash flow.
        // Instead, let's just verify the pool accepts swaps with our pool key
        // by calling PoolManager.unlock from a test helper.
        SwapTestHelper helper = new SwapTestHelper(POOL_MANAGER, WARPGOBB, WETH, _poolKey());

        // Fund the helper
        vm.prank(address(sniper));
        IERC20(WARPGOBB).transfer(address(helper), amountIn);

        uint256 wethOut = helper.swapExactIn(amountIn);
        console2.log("WARPGOBB in:", amountIn);
        console2.log("WETH out:", wethOut);
        assertGt(wethOut, 0, "V4 swap returned 0 WETH");
    }

    // ═════════════════════════════════════════════════════════════════
    //  Step 5: Full snipe flow with mock Seaport
    // ═════════════════════════════════════════════════════════════════

    function test_fork_full_snipe_with_mock_seaport() public {
        _fork();

        // Use a real Warplet
        uint256 tokenId = 1;
        address nftOwner = IERC721(WARPLETS).ownerOf(tokenId);

        // Deploy mock seaport
        MockForkSeaport mockSeaport = new MockForkSeaport(WARPLETS, tokenId, nftOwner);
        uint256 nftPrice = 0.001 ether;
        mockSeaport.setPrice(nftPrice);

        // Approve mock seaport for the NFT
        vm.prank(nftOwner);
        IERC721(WARPLETS).approve(address(mockSeaport), tokenId);

        // Deploy fresh reserve, auction, sniper (with mock seaport)
        reserve = new ForkNftReserve();
        auction = new DutchAuctionV2(WARPLETS, WARPGOBB, address(reserve), feeHandler);
        sniper = new GobbleSniper(
            WARPLETS, address(auction), WARPGOBB, WETH,
            POOL_MANAGER, address(mockSeaport), _poolKey(), recipient
        );

        // Fund the auction pot
        uint256 pot = 1_000e18;
        bool funded = _fundWithWarpgobb(address(auction), pot);
        if (!funded) { console2.log("SKIP: no WARPGOBB available"); return; }

        console2.log("Pot:", auction.currentPrice());
        console2.log("NFT price:", nftPrice);

        uint256 recipientBefore = recipient.balance;

        // Execute the snipe
        vm.prank(caller);
        sniper.snipe(tokenId, abi.encodeWithSignature("buy()"), nftPrice, 0, 0);

        // Verify results
        assertEq(IERC721(WARPLETS).ownerOf(tokenId), address(reserve), "NFT not in reserve");
        assertEq(auction.currentPrice(), 0, "Pot not drained");

        uint256 profit = recipient.balance - recipientBefore;
        console2.log("Profit (wei):", profit);
        assertGt(profit, 0, "No profit");
    }

    // ═════════════════════════════════════════════════════════════════
    //  Step 6: Test the DEPLOYED sniper (not freshly deployed)
    // ═════════════════════════════════════════════════════════════════

    function test_fork_deployed_sniper_erc1820_registered() public {
        _fork();
        address deployed = 0x691110e5C643cEE2155Adb745D6dcdca67E23CA8;
        (bool ok, bytes memory data) = ERC1820.staticcall(
            abi.encodeWithSignature(
                "getInterfaceImplementer(address,bytes32)",
                deployed,
                keccak256("ERC777TokensRecipient")
            )
        );
        require(ok, "ERC1820 call failed");
        address impl = abi.decode(data, (address));
        assertEq(impl, deployed, "Deployed sniper not registered as ERC777 recipient");
    }
}

/// @dev Helper to test V4 swaps in isolation on fork.
contract SwapTestHelper {
    address public poolManager;
    address public warpgobb;
    address public weth;
    PoolKey public poolKey;
    uint256 private _amountIn;

    uint160 internal constant MIN_SQRT_PRICE = 4295128739;
    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;

    constructor(address _pm, address _wg, address _weth, PoolKey memory _pk) {
        poolManager = _pm;
        warpgobb = _wg;
        weth = _weth;
        poolKey = _pk;
    }

    function swapExactIn(uint256 amountIn) external returns (uint256 wethOut) {
        _amountIn = amountIn;
        bytes memory result = IPoolManagerUnlock(poolManager).unlock(abi.encode(amountIn));
        wethOut = abi.decode(result, (uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == poolManager, "not PM");
        uint256 amountIn = abi.decode(data, (uint256));

        bool zeroForOne = warpgobb < weth;
        IPoolManagerSwap.SwapParams memory params = IPoolManagerSwap.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE + 1 : MAX_SQRT_PRICE - 1
        });

        int256 rawDelta = IPoolManagerSwap(poolManager).swap(poolKey, params, "");
        int128 amount0 = int128(rawDelta >> 128);
        int128 amount1 = int128(rawDelta);

        uint256 owed;
        uint256 received;
        if (zeroForOne) {
            owed = uint256(uint128(amount0 > 0 ? amount0 : -amount0));
            received = uint256(uint128(amount1 > 0 ? amount1 : -amount1));
        } else {
            owed = uint256(uint128(amount1 > 0 ? amount1 : -amount1));
            received = uint256(uint128(amount0 > 0 ? amount0 : -amount0));
        }

        IPoolManagerSettle(poolManager).sync(Currency.wrap(warpgobb));
        IERC20(warpgobb).transfer(poolManager, owed);
        IPoolManagerSettle(poolManager).settle();
        IPoolManagerSettle(poolManager).take(Currency.wrap(weth), address(this), received);

        // Send WETH back to caller for assertion
        IERC20(weth).transfer(msg.sender, received);

        return abi.encode(received);
    }
}

interface IPoolManagerUnlock {
    function unlock(bytes calldata data) external returns (bytes memory);
}

interface IPoolManagerSwap {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external returns (int256);
}

interface IPoolManagerSettle {
    function sync(Currency currency) external;
    function settle() external payable returns (uint256);
    function take(Currency currency, address to, uint256 amount) external;
}

/// @dev Simple hook: receives WARPGOBB via tokensReceived, delivers Warplet to reserve.
contract SimpleDeliverHook is IERC721Receiver {
    IERC721 public warplets;
    address public reserve;

    constructor(address _warplets, address _reserve) {
        warplets = IERC721(_warplets);
        reserve = _reserve;
    }

    function tokensReceived(
        address, address, address,
        uint256, bytes calldata userData, bytes calldata
    ) external {
        uint256 tokenId = abi.decode(userData, (uint256));
        warplets.safeTransferFrom(address(this), reserve, tokenId);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
