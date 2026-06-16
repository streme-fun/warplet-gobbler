// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {DutchAuctionV2} from "../src/DutchAuctionV2.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice Deploy `DutchAuctionV2` then atomically repoint `FeeHandler` and restart stream.
/// @dev For a **full** stack redeploy (GobbledWarplets + AuctionSell + Gobbler + FeeHandler), use
///      `DeployWarpletGobblerStack.s.sol` instead.
///
/// Required env:
/// - `WARPLETS_NFT_ADDRESS`
/// - `DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS`
/// - `DUTCH_AUCTION_NFT_RESERVE_ADDRESS` (typically AuctionSell)
/// - `FEE_HANDLER_ADDRESS`
/// - Exactly one of `PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY`
contract MigrateToNewDutchAuctionV2 is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();

        address warplets = vm.envAddress("WARPLETS_NFT_ADDRESS");
        address payment = vm.envAddress("DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS");
        address nftReserve = vm.envAddress("DUTCH_AUCTION_NFT_RESERVE_ADDRESS");
        address feeHandlerAddr = vm.envAddress("FEE_HANDLER_ADDRESS");

        vm.startBroadcast(pk);

        DutchAuctionV2 auction = new DutchAuctionV2(warplets, payment, nftReserve, feeHandlerAddr);
        console2.log("DutchAuctionV2 (new):", address(auction));

        FeeHandler(feeHandlerAddr).setAuction(address(auction));
        FeeHandler(feeHandlerAddr).startStream();

        vm.stopBroadcast();

        console2.log("FeeHandler pointed at new DutchAuctionV2; stream restarted.");
    }
}
