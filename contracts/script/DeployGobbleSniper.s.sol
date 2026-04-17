// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {
    GobbleSniper,
    PoolKey,
    Currency
} from "../src/GobbleSniper.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

interface IERC1820Registry {
    function getInterfaceImplementer(address account, bytes32 interfaceHash) external view returns (address);
}

/// @notice Deploy `GobbleSniper` wired to `DutchAuctionV2`.
/// @dev Required env:
/// - `WARPLETS_NFT_ADDRESS`
/// - `DUTCH_AUCTION_V2_ADDRESS`
/// - `DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS` (WARPGOBB)
/// - `WETH_ADDRESS`
/// - `POOL_MANAGER_ADDRESS`
/// - `SEAPORT_ADDRESS`
/// - `SNIPER_POOL_FEE`
/// - `SNIPER_POOL_TICK_SPACING`
/// - `SNIPER_POOL_HOOKS` (can be zero address)
/// - `SNIPER_PROFIT_RECIPIENT` (optional; defaults deployer)
/// - Exactly one of `PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY`
contract DeployGobbleSniper is DeployHelpers {
    bytes32 internal constant ERC777_TOKENS_RECIPIENT_HASH = keccak256("ERC777TokensRecipient");
    address internal constant ERC1820_REGISTRY = 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;

    function run() external {
        uint256 pk = _loadPrivateKey();
        address deployer = vm.addr(pk);

        address warplets = vm.envAddress("WARPLETS_NFT_ADDRESS");
        address gobbler = vm.envAddress("DUTCH_AUCTION_V2_ADDRESS");
        address warpgobb = vm.envAddress("DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS");
        address weth = vm.envAddress("WETH_ADDRESS");
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address seaport = vm.envAddress("SEAPORT_ADDRESS");

        uint256 feeRaw = vm.envUint("SNIPER_POOL_FEE");
        uint256 tickRaw = vm.envUint("SNIPER_POOL_TICK_SPACING");
        require(feeRaw <= type(uint24).max, "DeployGobbleSniper: fee too large");
        require(
            tickRaw <= uint256(uint24(type(int24).max)),
            "DeployGobbleSniper: tick spacing too large"
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

        vm.startBroadcast(pk);

        GobbleSniper sniper = new GobbleSniper(
            warplets, gobbler, warpgobb, weth, poolManager, seaport, key, recipient
        );

        vm.stopBroadcast();

        address registeredRecipient = IERC1820Registry(ERC1820_REGISTRY).getInterfaceImplementer(
            address(sniper),
            ERC777_TOKENS_RECIPIENT_HASH
        );
        require(
            registeredRecipient == address(sniper),
            "DeployGobbleSniper: ERC1820 recipient registration missing"
        );

        console2.log("GobbleSniper:", address(sniper));
        console2.log("gobbler (DutchAuctionV2):", gobbler);
        console2.log("recipient:", recipient);
        console2.log("ERC777 recipient registered:", registeredRecipient);
    }
}
