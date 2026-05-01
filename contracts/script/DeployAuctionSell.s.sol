// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {NFTReserve} from "../src/NFTReserve.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice Deploy `NFTReserve`, `GobbledWarplets`, and `AuctionSell`.
/// @dev `NFTReserve` is owned by the **broadcast signer** until optional `FINAL_NFT_RESERVE_OWNER` transfers it.
///      `reserve.setAuction(address(sell))` runs inside the broadcast so Gobbled receipts + reserve queue ACL wire
///      in one submission (requires `nft.setApprovalForAll` / `onlyOwner` to succeed — key must deploy + own reserve).
///      `AuctionSell` deploys paused; unpause via `AuctionSell.unpause()` or `AuctionSellUnpause.s.sol`.
///
/// Broadcast + verify on Base (Forge loads `contracts/.env`):
/// ```
/// forge script script/DeployAuctionSell.s.sol:DeployAuctionSell --rpc-url base --broadcast --verify -vvv
/// ```
///
/// Required env:
/// - `PRIVATE_KEY` **xor** `DEPLOYER_PRIVATE_KEY`
/// - `WARPLETS_NFT_ADDRESS`, `AUCTION_SELL_BID_TOKEN_ADDRESS`, `AUCTION_SELL_PROCEEDS_RECIPIENT`,
///   `AUCTION_SELL_OWNER`, `AUCTION_RESERVE_PRICE_WEI`, `AUCTION_TIME_BUFFER_SECONDS`,
///   `AUCTION_MIN_BID_INCREMENT_PERCENT`, `AUCTION_DURATION_SECONDS`,
///   `GOBBLED_WARPLETS_NAME`, `GOBBLED_WARPLETS_SYMBOL`
///
/// Optional: `GOBBLED_WARPLETS_TOKEN_URI_SETTER` (defaults to deployer).
/// Optional: `AUCTION_SELL_STREME_ZAP` — omit or zero for ERC20 bids only.
/// Optional: `FINAL_NFT_RESERVE_OWNER`, `FINAL_GOBBLED_WARPLETS_OWNER` — Ownable transfer after wiring (omit to keep deployer-owned).
contract DeployAuctionSell is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        address tokenURISetter = vm.envOr("GOBBLED_WARPLETS_TOKEN_URI_SETTER", deployer);

        NFTReserve reserve = new NFTReserve(IERC721(vm.envAddress("WARPLETS_NFT_ADDRESS")), deployer);

        GobbledWarplets gobbled = new GobbledWarplets(
            vm.envString("GOBBLED_WARPLETS_NAME"),
            vm.envString("GOBBLED_WARPLETS_SYMBOL"),
            address(reserve),
            tokenURISetter
        );
        reserve.setGobbledWarplets(gobbled);

        AuctionSell sell = _newAuctionSell(gobbled);
        reserve.setAuction(address(sell));

        address finalReserve = vm.envOr("FINAL_NFT_RESERVE_OWNER", address(0));
        if (finalReserve != address(0) && finalReserve != deployer) {
            reserve.transferOwnership(finalReserve);
        }

        address finalGobbled = vm.envOr("FINAL_GOBBLED_WARPLETS_OWNER", address(0));
        if (finalGobbled != address(0) && finalGobbled != deployer) {
            gobbled.transferOwnership(finalGobbled);
        }

        vm.stopBroadcast();

        console2.log("GobbledWarplets:", address(gobbled));
        console2.log("NFTReserve:", address(reserve));
        console2.log("AuctionSell:", address(sell));
        console2.log("AuctionSell owner:", sell.owner());
        console2.log("AuctionSell.paused:", sell.paused());
    }

    function _newAuctionSell(GobbledWarplets gobbled) internal returns (AuctionSell sell) {
        uint256 minPctRaw = vm.envUint("AUCTION_MIN_BID_INCREMENT_PERCENT");
        require(minPctRaw <= type(uint8).max, "DeployAuctionSell: AUCTION_MIN_BID_INCREMENT_PERCENT too large");

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
            vm.envOr("AUCTION_SELL_STREME_ZAP", address(0))
        );
    }
}
