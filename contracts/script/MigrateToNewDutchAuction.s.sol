// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {DutchAuction} from "../src/DutchAuction.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice One transaction sequence: deploy `DutchAuction` → `FeeHandler.setAuction` → `FeeHandler.startStream`.
/// @dev Requires old DutchAuction pot drained so `setAuction`’s `transferFrom` path is skipped. Caller must be
///      `FeeHandler` `DEFAULT_ADMIN_ROLE`. Uses the same env as `DeployDutchAuction.s.sol` plus no extra keys.
///
/// ```
/// forge script script/MigrateToNewDutchAuction.s.sol:MigrateToNewDutchAuction --rpc-url base --broadcast --verify -vvv
/// ```
///
/// Required env: `WARPLETS_NFT_ADDRESS`, `DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS`, `DUTCH_AUCTION_NFT_RESERVE_ADDRESS`
/// (your `AuctionSell`), `FEE_HANDLER_ADDRESS`, and exactly one of `PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY`.
contract MigrateToNewDutchAuction is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();

        address warplets = vm.envAddress("WARPLETS_NFT_ADDRESS");
        address payment = vm.envAddress("DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS");
        address nftReserve = vm.envAddress("DUTCH_AUCTION_NFT_RESERVE_ADDRESS");
        address feeHandlerAddr = vm.envAddress("FEE_HANDLER_ADDRESS");

        vm.startBroadcast(pk);

        DutchAuction auction = new DutchAuction(warplets, payment, nftReserve, feeHandlerAddr);
        console2.log("DutchAuction (new):", address(auction));

        FeeHandler(feeHandlerAddr).setAuction(address(auction));
        FeeHandler(feeHandlerAddr).startStream();

        vm.stopBroadcast();

        console2.log("FeeHandler pointed at new DutchAuction; stream restarted.");
    }
}
