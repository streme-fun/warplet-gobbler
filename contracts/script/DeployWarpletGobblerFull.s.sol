// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NFTReserve} from "../src/NFTReserve.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {DutchAuction} from "../src/DutchAuction.sol";
import {DutchAuctionV2} from "../src/DutchAuctionV2.sol";
import {GobbleSniper, PoolKey, Currency} from "../src/GobbleSniper.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

interface IERC1820Registry {
    function getInterfaceImplementer(address account, bytes32 interfaceHash) external view returns (address);
}

/// @notice Greenfield stack: NFTReserve + GobbledWarplets + AuctionSell (with `setAuction`), FeeHandler with
///         placeholder Dutch, then DutchAuction **V1 or V2** sharing the same NFTReserve as deposit target,
///         optional GobbleSniper, then `FeeHandler.setAuction` + `startStream` when broadcaster is admin.
///
/// Broadcasting EOA temporarily owns NFTReserve (and GobbledWarplets) so scripted wiring succeeds. Optional:
/// `FINAL_NFT_RESERVE_OWNER`, `FINAL_GOBBLED_WARPLETS_OWNER`.
///
/// ```
/// forge script script/DeployWarpletGobblerFull.s.sol:DeployWarpletGobblerFull --rpc-url base --broadcast --verify -vvv
/// ```
///
/// Required env: use `.env.example` **DeployWarpletGobblerFull** section. Also needs all keys from
/// DeployAuctionSell + DeployFeeHandler + DeployDutchAuction (shared `WARPLETS_NFT_ADDRESS` / payment token paths).
///
/// Flags (optional): `DUTCH_AUCTION_FLAVOR` = `v1` or `v2` (default **v2** if unset).
/// Set `DEPLOY_GOBBLE_SNIPER` to non-zero (+ sniper_* keys from `DeployGobbleSniper.s.sol`) to deploy GobbleSniper.
contract DeployWarpletGobblerFull is DeployHelpers {
    address internal constant PLACEHOLDER_AUCTION = 0x000000000000000000000000000000000000dEaD;
    bytes32 internal constant ERC777_TOKENS_RECIPIENT_HASH = keccak256("ERC777TokensRecipient");
    address internal constant ERC1820_REGISTRY = 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;

    function run() external {
        uint256 pk = _loadPrivateKey();
        address deployer = vm.addr(pk);

        address warplets = vm.envAddress("WARPLETS_NFT_ADDRESS");
        address payment = vm.envAddress("DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS");

        vm.startBroadcast(pk);

        FeeHandler feeHandler = _newFeeHandler();
        NFTReserve reserve = new NFTReserve(IERC721(warplets), deployer);

        GobbledWarplets gobbled = _newGobbledWarplets(address(reserve), deployer);
        reserve.setGobbledWarplets(gobbled);

        AuctionSell sell = _newAuctionSell(gobbled);
        reserve.setAuction(address(sell));

        address dutch = _newDutch(warplets, payment, address(reserve), address(feeHandler));

        if (_deploySniperFlag()) _deployGobbleSniper(deployer, warplets, dutch, payment);

        address finalReserve = vm.envOr("FINAL_NFT_RESERVE_OWNER", address(0));
        if (finalReserve != address(0) && finalReserve != deployer) reserve.transferOwnership(finalReserve);

        address finalGobbled = vm.envOr("FINAL_GOBBLED_WARPLETS_OWNER", address(0));
        if (finalGobbled != address(0) && finalGobbled != deployer) gobbled.transferOwnership(finalGobbled);

        vm.stopBroadcast();

        _wireFeeWhenAdmin(pk, deployer, address(feeHandler), dutch);

        console2.log("--- Deployed ---");
        console2.log("NFTReserve:", address(reserve));
        console2.log("GobbledWarplets:", address(gobbled));
        console2.log("AuctionSell:", address(sell));
        console2.log("FeeHandler:", address(feeHandler));
        console2.log("DutchAuction (gobbler):", dutch);
        console2.log("AuctionSell.paused (expected true):", sell.paused());
    }

    function _newFeeHandler() internal returns (FeeHandler) {
        return new FeeHandler(
            vm.envAddress("WETH_ADDRESS"),
            vm.envAddress("STREME_TOKEN_ADDRESS"),
            vm.envAddress("LP_FACTORY_V4_ADDRESS"),
            PLACEHOLDER_AUCTION,
            vm.envAddress("STREME_ZAP_ADDRESS"),
            vm.envUint("TARGET_DURATION_SECONDS"),
            vm.envAddress("ADMIN_ADDRESS"),
            vm.envOr("REBALANCER_ADDRESS", address(0))
        );
    }

    function _newGobbledWarplets(address reserveAddr, address deployer) internal returns (GobbledWarplets gobbled) {
        address tokenURISetter = vm.envOr("GOBBLED_WARPLETS_TOKEN_URI_SETTER", deployer);
        gobbled = new GobbledWarplets(
            vm.envString("GOBBLED_WARPLETS_NAME"),
            vm.envString("GOBBLED_WARPLETS_SYMBOL"),
            reserveAddr,
            tokenURISetter
        );
    }

    function _newAuctionSell(GobbledWarplets gobbled) internal returns (AuctionSell) {
        uint256 minPctRaw = vm.envUint("AUCTION_MIN_BID_INCREMENT_PERCENT");
        require(minPctRaw <= type(uint8).max, "DeployWarpletGobblerFull: AUCTION_MIN_BID_INCREMENT_PERCENT too large");

        return new AuctionSell(
            IERC721(vm.envAddress("WARPLETS_NFT_ADDRESS")),
            IERC20(vm.envAddress("AUCTION_SELL_BID_TOKEN_ADDRESS")),
            gobbled,
            vm.envAddress("AUCTION_SELL_PROCEEDS_RECIPIENT"),
            vm.envUint("AUCTION_TIME_BUFFER_SECONDS"),
            vm.envUint("AUCTION_RESERVE_PRICE_WEI"),
            uint8(minPctRaw),
            vm.envUint("AUCTION_DURATION_SECONDS"),
            vm.envAddress("AUCTION_SELL_OWNER"),
            vm.envOr("AUCTION_SELL_STREME_ZAP", address(0))
        );
    }

    function _newDutch(address warplets, address paymentTok, address nftReserve, address feeHandlerAddr)
        internal
        returns (address dutch)
    {
        string memory flavor = "v2";
        if (vm.envExists("DUTCH_AUCTION_FLAVOR")) {
            flavor = vm.envString("DUTCH_AUCTION_FLAVOR");
        }
        bytes32 f = keccak256(bytes(flavor));

        if (f == keccak256(bytes("v1")) || f == keccak256(bytes("V1"))) {
            dutch = address(new DutchAuction(warplets, paymentTok, nftReserve, feeHandlerAddr));
            return dutch;
        }
        dutch = address(new DutchAuctionV2(warplets, paymentTok, nftReserve, feeHandlerAddr));
    }

    function _deploySniperFlag() internal view returns (bool) {
        if (!vm.envExists("DEPLOY_GOBBLE_SNIPER")) return false;
        return vm.envUint("DEPLOY_GOBBLE_SNIPER") != 0;
    }

    function _deployGobbleSniper(address deployer, address warplets, address gobbler, address warpgobb) internal {
        address weth = vm.envAddress("WETH_ADDRESS");
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address seaport = vm.envAddress("SEAPORT_ADDRESS");

        uint256 feeRaw = vm.envUint("SNIPER_POOL_FEE");
        uint256 tickRaw = vm.envUint("SNIPER_POOL_TICK_SPACING");
        require(feeRaw <= type(uint24).max, "DeployWarpletGobblerFull: SNIPER_POOL_FEE too large");
        require(
            tickRaw <= uint256(uint24(type(int24).max)),
            "DeployWarpletGobblerFull: SNIPER_POOL_TICK_SPACING too large"
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

        GobbleSniper sniper = new GobbleSniper(
            warplets, gobbler, warpgobb, weth, poolManager, seaport, key, recipient
        );

        address registeredRecipient = IERC1820Registry(ERC1820_REGISTRY).getInterfaceImplementer(
            address(sniper), ERC777_TOKENS_RECIPIENT_HASH
        );
        require(
            registeredRecipient == address(sniper),
            "DeployWarpletGobblerFull: ERC1820 recipient registration missing for GobbleSniper"
        );

        console2.log("GobbleSniper:", address(sniper));
        console2.log("ERC777 recipient verified:", registeredRecipient);
    }

    function _wireFeeWhenAdmin(uint256 pk, address deployer, address feeHandlerAddr, address dutchAuction) internal {
        address admin = vm.envAddress("ADMIN_ADDRESS");

        if (deployer != admin) {
            console2.log("");
            console2.log("Deployer != ADMIN_ADDRESS: run as FeeHandler DEFAULT_ADMIN_ROLE:");
            console2.log("  setAuction(new Dutch)");
            console2.log("  startStream()");
            console2.log("FeeHandler:", feeHandlerAddr);
            console2.log("Dutch (gobbler):", dutchAuction);
            return;
        }

        vm.startBroadcast(pk);
        FeeHandler(feeHandlerAddr).setAuction(dutchAuction);
        FeeHandler(feeHandlerAddr).startStream();
        vm.stopBroadcast();

        console2.log("FeeHandler.setAuction + startStream (admin == deployer).");
    }
}
