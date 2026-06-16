// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {DutchAuctionV2} from "../src/DutchAuctionV2.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {
    GobbleSniper,
    PoolKey,
    Currency
} from "../src/GobbleSniper.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

interface IERC1820Registry {
    function getInterfaceImplementer(address account, bytes32 interfaceHash) external view returns (address);
}

/// @notice One-shot migration deploy: `GobbledWarplets` → `AuctionSell` → `DutchAuctionV2` → repoint `FeeHandler`.
///         Optionally deploys `GobbleSniper` when `DEPLOY_GOBBLE_SNIPER=1`.
/// @dev `AuctionSell` deploys **paused** — unpause via `AuctionSellUnpause.s.sol` when ready.
///      `DUTCH_AUCTION_NFT_RESERVE_ADDRESS` is **not** needed; the new auction is wired automatically.
///
/// ```
/// forge script script/DeployWarpletGobblerStack.s.sol:DeployWarpletGobblerStack \
///   --rpc-url base --broadcast --verify -vvv
/// ```
///
/// Required env:
/// - `PRIVATE_KEY` xor `DEPLOYER_PRIVATE_KEY`
/// - `WARPLETS_NFT_ADDRESS`
/// - `AUCTION_SELL_BID_TOKEN_ADDRESS`
/// - `AUCTION_SELL_PROCEEDS_RECIPIENT`, `AUCTION_SELL_OWNER`
/// - `AUCTION_RESERVE_PRICE_WEI`, `AUCTION_TIME_BUFFER_SECONDS`
/// - `AUCTION_MIN_BID_INCREMENT_PERCENT`, `AUCTION_DURATION_SECONDS`
/// - `GOBBLED_WARPLETS_NAME`, `GOBBLED_WARPLETS_SYMBOL`
/// - `FEE_HANDLER_ADDRESS`
/// - `DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS` (defaults to `AUCTION_SELL_BID_TOKEN_ADDRESS`)
/// Optional:
/// - `GOBBLED_WARPLETS_TOKEN_URI_SETTER` (defaults to deployer)
/// - `AUCTION_SELL_STREME_ZAP` (defaults to Base mainnet StremeZap)
/// - `DEPLOY_GOBBLE_SNIPER=1` plus sniper pool env (see `DeployGobbleSniper.s.sol`)
contract DeployWarpletGobblerStack is DeployHelpers {
    /// @dev Streme `StremeZapUniversal` on Base mainnet (same address `FeeHandler` uses).
    address internal constant STREME_ZAP_BASE_MAINNET = 0xEe3f62CF6987121f9cBe567C0E5a01c940A7e570;
    address internal constant ERC1820_REGISTRY = 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;
    bytes32 internal constant ERC777_TOKENS_RECIPIENT_HASH = keccak256("ERC777TokensRecipient");

    function run() external {
        uint256 pk = _loadPrivateKey();
        address deployer = vm.addr(pk);

        address warplets = vm.envAddress("WARPLETS_NFT_ADDRESS");
        address bidToken = vm.envAddress("AUCTION_SELL_BID_TOKEN_ADDRESS");
        address paymentToken = vm.envOr("DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS", bidToken);
        address feeHandlerAddr = vm.envAddress("FEE_HANDLER_ADDRESS");
        address tokenURISetter = vm.envOr("GOBBLED_WARPLETS_TOKEN_URI_SETTER", deployer);

        vm.startBroadcast(pk);

        GobbledWarplets gobbled = new GobbledWarplets(
            vm.envString("GOBBLED_WARPLETS_NAME"),
            vm.envString("GOBBLED_WARPLETS_SYMBOL"),
            deployer,
            tokenURISetter
        );

        AuctionSell sell = _newAuctionSell(gobbled);
        gobbled.setMinter(address(sell));

        DutchAuctionV2 gobbler = new DutchAuctionV2(warplets, paymentToken, address(sell), feeHandlerAddr);

        FeeHandler(feeHandlerAddr).setAuction(address(gobbler));
        FeeHandler(feeHandlerAddr).startStream();

        address sniper = address(0);
        if (vm.envOr("DEPLOY_GOBBLE_SNIPER", false)) {
            sniper = _deployGobbleSniper(warplets, address(gobbler), paymentToken, deployer);
        }

        vm.stopBroadcast();

        if (sniper != address(0)) {
            address registeredRecipient = IERC1820Registry(ERC1820_REGISTRY).getInterfaceImplementer(
                sniper,
                ERC777_TOKENS_RECIPIENT_HASH
            );
            require(
                registeredRecipient == sniper,
                "DeployWarpletGobblerStack: ERC1820 recipient registration missing"
            );
        }

        console2.log("=== WarpletGobbler stack deployed ===");
        console2.log("GobbledWarplets:", address(gobbled));
        console2.log("AuctionSell:", address(sell));
        console2.log("AuctionSell paused:", sell.paused());
        console2.log("AuctionSell stremeZap:", address(sell.stremeZap()));
        console2.log("DutchAuctionV2:", address(gobbler));
        console2.log("FeeHandler:", feeHandlerAddr);
        console2.log("GobbledWarplets owner:", gobbled.owner());
        console2.log("GobbledWarplets tokenURISetter:", gobbled.tokenURISetter());
        if (sniper != address(0)) {
            console2.log("GobbleSniper:", sniper);
        }
        console2.log("Next: unpause AuctionSell when ready (AuctionSellUnpause.s.sol)");
    }

    function _newAuctionSell(GobbledWarplets gobbled) internal returns (AuctionSell sell) {
        uint256 minPctRaw = vm.envUint("AUCTION_MIN_BID_INCREMENT_PERCENT");
        require(minPctRaw <= type(uint8).max, "DeployWarpletGobblerStack: min bid increment too large");

        address stremeZap = vm.envOr("AUCTION_SELL_STREME_ZAP", STREME_ZAP_BASE_MAINNET);
        require(stremeZap != address(0), "DeployWarpletGobblerStack: AUCTION_SELL_STREME_ZAP required");

        sell = new AuctionSell(
            IERC721(vm.envAddress("WARPLETS_NFT_ADDRESS")),
            IERC20(vm.envAddress("AUCTION_SELL_BID_TOKEN_ADDRESS")),
            gobbled,
            vm.envAddress("AUCTION_SELL_PROCEEDS_RECIPIENT"),
            vm.envUint("AUCTION_TIME_BUFFER_SECONDS"),
            vm.envUint("AUCTION_RESERVE_PRICE_WEI"),
            uint8(minPctRaw),
            vm.envUint("AUCTION_DURATION_SECONDS"),
            vm.envAddress("AUCTION_SELL_OWNER"),
            stremeZap
        );
    }

    function _deployGobbleSniper(address warplets, address gobbler, address warpgobb, address deployer)
        internal
        returns (address sniper)
    {
        address weth = vm.envAddress("WETH_ADDRESS");
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address seaport = vm.envAddress("SEAPORT_ADDRESS");

        uint256 feeRaw = vm.envUint("SNIPER_POOL_FEE");
        uint256 tickRaw = vm.envUint("SNIPER_POOL_TICK_SPACING");
        require(feeRaw <= type(uint24).max, "DeployWarpletGobblerStack: sniper fee too large");
        require(
            tickRaw <= uint256(uint24(type(int24).max)),
            "DeployWarpletGobblerStack: sniper tick spacing too large"
        );

        address hooks = vm.envAddress("SNIPER_POOL_HOOKS");
        address recipient = vm.envOr("SNIPER_PROFIT_RECIPIENT", deployer);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(warpgobb < weth ? warpgobb : weth),
            currency1: Currency.wrap(warpgobb < weth ? weth : warpgobb),
            fee: uint24(feeRaw),
            tickSpacing: int24(int256(tickRaw)),
            hooks: hooks
        });

        sniper = address(
            new GobbleSniper(warplets, gobbler, warpgobb, weth, poolManager, seaport, key, recipient)
        );
    }
}
