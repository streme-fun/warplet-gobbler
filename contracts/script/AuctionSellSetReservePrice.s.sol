// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice `AuctionSell.setReservePrice` — `owner` only; updates minimum opening bid for new bids.
///
/// ```
/// forge script script/AuctionSellSetReservePrice.s.sol:AuctionSellSetReservePrice --rpc-url base --broadcast -vvv
/// ```
///
/// Required env:
/// - `AUCTION_SELL_ADDRESS`
/// - `AUCTION_RESERVE_PRICE_WEI` — minimum bid in WARPGOBB wei (18 decimals)
/// - Exactly one of `PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY` (must be `AuctionSell` owner)
contract AuctionSellSetReservePrice is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();
        address sell = vm.envAddress("AUCTION_SELL_ADDRESS");
        uint256 reserveWei = vm.envUint("AUCTION_RESERVE_PRICE_WEI");

        AuctionSell auctionSell = AuctionSell(payable(sell));
        uint256 before = auctionSell.reservePrice();

        console2.log("AuctionSell:", sell);
        console2.log("reservePrice before:", before);
        console2.log("reservePrice after:", reserveWei);

        vm.startBroadcast(pk);
        auctionSell.setReservePrice(reserveWei);
        vm.stopBroadcast();

        require(auctionSell.reservePrice() == reserveWei, "AuctionSellSetReservePrice: update failed");
        console2.log("AuctionSell.setReservePrice() done");
    }
}
