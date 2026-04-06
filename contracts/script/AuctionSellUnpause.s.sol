// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice `AuctionSell.unpause()` — must be `owner` (typically same key as deploy).
///
/// ```
/// forge script script/AuctionSellUnpause.s.sol:AuctionSellUnpause --rpc-url base --broadcast -vvv
/// ```
///
/// Required env: `AUCTION_SELL_ADDRESS`, and exactly one of `PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY`.
contract AuctionSellUnpause is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();
        address sell = vm.envAddress("AUCTION_SELL_ADDRESS");

        vm.startBroadcast(pk);
        AuctionSell(sell).unpause();
        vm.stopBroadcast();

        console2.log("AuctionSell.unpause() done:", sell);
    }
}
