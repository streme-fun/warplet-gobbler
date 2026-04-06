// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {DutchAuction} from "../src/DutchAuction.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice Deploy a new `DutchAuction` (“The Gobbler”) with `nftReserve` pointing at your `AuctionSell` queue.
/// @dev Constructor approves `FEE_HANDLER_ADDRESS` on the payment token so `FeeHandler.setAuction` can later
///      `transferFrom` the old auction’s balance during migration.
///
/// Broadcast + verify:
/// ```
/// forge script script/DeployDutchAuction.s.sol:DeployDutchAuction --rpc-url base --broadcast --verify -vvv
/// ```
///
/// Required env:
/// - `PRIVATE_KEY` xor `DEPLOYER_PRIVATE_KEY`
/// - `WARPLETS_NFT_ADDRESS` — Warplets ERC721
/// - `DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS` — $WARPGOBB / Streme ERC20 the gobbler pays out (same token the stream funds)
/// - `DUTCH_AUCTION_NFT_RESERVE_ADDRESS` — **`AuctionSell`** (gobbled Warplets are `safeTransferFrom`’d here)
/// - `FEE_HANDLER_ADDRESS` — existing `FeeHandler` (receives `type(uint256).max` allowance from this auction)
///
/// ---------------------------------------------------------------------------
/// Point `FeeHandler` at this new gobbler (live test / cutover)
/// ---------------------------------------------------------------------------
/// On the **existing** `FeeHandler`, as `DEFAULT_ADMIN_ROLE`:
/// 1. `setAuction(<new DutchAuction address>)` — stops the flow to the old auction, pulls stray Streme balance from
///    the old auction into the handler (old auction must still be the one that granted this handler allowance),
///    sets `auction` to the new address, sets `streamActive = false`.
/// 2. `startStream()` — recomputes flow from handler balance and streams to the **new** `DutchAuction`.
///
/// Update your app / indexers to the new DutchAuction address as needed.
contract DeployDutchAuction is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();

        address warplets = vm.envAddress("WARPLETS_NFT_ADDRESS");
        address payment = vm.envAddress("DUTCH_AUCTION_PAYMENT_TOKEN_ADDRESS");
        address nftReserve = vm.envAddress("DUTCH_AUCTION_NFT_RESERVE_ADDRESS");
        address feeHandler = vm.envAddress("FEE_HANDLER_ADDRESS");

        vm.startBroadcast(pk);

        DutchAuction auction = new DutchAuction(warplets, payment, nftReserve, feeHandler);

        vm.stopBroadcast();

        console2.log("DutchAuction:", address(auction));
        console2.log("warplets:", warplets);
        console2.log("paymentToken:", payment);
        console2.log("nftReserve (AuctionSell):", nftReserve);
        console2.log("feeHandler (allowance spender):", feeHandler);
    }
}
