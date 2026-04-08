// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {DutchAuction} from "../src/DutchAuction.sol";

/// @notice Deploy `FeeHandler` then `DutchAuction` (approves fee handler), wire via `setAuction` + `startStream`.
/// @dev Requires: WETH_ADDRESS, STREME_TOKEN_ADDRESS, LP_FACTORY_V4_ADDRESS, STREME_ZAP_ADDRESS,
///      TARGET_DURATION_SECONDS, ADMIN_ADDRESS, WARPLETS_NFT_ADDRESS, DUTCH_AUCTION_NFT_RESERVE_ADDRESS,
///      PRIVATE_KEY (deployer). Optional: REBALANCER_ADDRESS (zero = skip role).
contract DeployFeeHandlerAndDutchAuction is Script {
    address internal constant PLACEHOLDER_AUCTION = 0x000000000000000000000000000000000000dEaD;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address weth = vm.envAddress("WETH_ADDRESS");
        address streme = vm.envAddress("STREME_TOKEN_ADDRESS");
        address lpFactory = vm.envAddress("LP_FACTORY_V4_ADDRESS");
        address zap = vm.envAddress("STREME_ZAP_ADDRESS");
        uint256 targetDuration = vm.envUint("TARGET_DURATION_SECONDS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address rebalancer = vm.envOr("REBALANCER_ADDRESS", address(0));

        address warplets = vm.envAddress("WARPLETS_NFT_ADDRESS");
        address nftReserve = vm.envAddress("DUTCH_AUCTION_NFT_RESERVE_ADDRESS");

        require(admin != address(0), "ADMIN_ADDRESS");

        vm.startBroadcast(pk);

        FeeHandler handler = new FeeHandler(weth, streme, lpFactory, PLACEHOLDER_AUCTION, zap, targetDuration, admin, rebalancer);
        console2.log("FeeHandler:", address(handler));

        DutchAuction auction = new DutchAuction(warplets, streme, nftReserve, address(handler));
        console2.log("DutchAuction:", address(auction));

        vm.stopBroadcast();

        if (admin != deployer) {
            console2.log("Deployer is not admin; call setAuction(start) as admin:");
            console2.log("  handler.setAuction(", address(auction), ")");
            console2.log("  handler.startStream()");
            return;
        }

        vm.startBroadcast(pk);
        handler.setAuction(address(auction));
        handler.startStream();
        vm.stopBroadcast();

        console2.log("Wired: setAuction + startStream (admin was deployer)");
    }
}
