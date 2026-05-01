// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {NFTReserve} from "../src/NFTReserve.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice Deploy `NFTReserve`, then `GobbledWarplets`, then `AuctionSell`.
///         Wire reserve→gobbled via `setGobbledWarplets`; **owner** must call `NFTReserve.setAuction(address(sell))` after
///         deploy to authorize `sell` on the queue and sync `GobbledWarplets.auction`.
/// @dev Auction deploys **paused**; unpause via `AuctionSell.unpause()` when ready.
///      **Every** parameter is read from env; missing keys make the script revert.
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
///   Optional: `GOBBLED_WARPLETS_TOKEN_URI_SETTER` (defaults to deployer) — signer for `GobbledWarplets.rescueWarplet` signatures.
///   Optional: `AUCTION_SELL_STREME_ZAP` — `StremeZapUniversal` for ETH bids; omit or `address(0)` for pull-only `bid()`.
contract DeployAuctionSell is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();

        vm.startBroadcast(pk);

        address deployer = vm.addr(pk);
        address tokenURISetter = vm.envOr("GOBBLED_WARPLETS_TOKEN_URI_SETTER", deployer);

        NFTReserve reserve = new NFTReserve(IERC721(vm.envAddress("WARPLETS_NFT_ADDRESS")), vm.envAddress("AUCTION_SELL_OWNER"), address(0));

        GobbledWarplets gobbled = new GobbledWarplets(
            vm.envString("GOBBLED_WARPLETS_NAME"),
            vm.envString("GOBBLED_WARPLETS_SYMBOL"),
            address(reserve),
            tokenURISetter
        );
        reserve.setGobbledWarplets(gobbled);

        AuctionSell sell = _newAuctionSell(gobbled);

        /// @dev `reserve.auction` and `gobbled.auction` stay unset here because this script finishes before a runner
        ///      exists. As `AUCTION_SELL_OWNER`, call once on-chain (after this broadcast completes):
        ///      `NFTReserve(reserve).setAuction(address(sell))` — that wires queue ACL and forwards to
        ///      `GobbledWarplets.setAuction` so settlement can `createReceipt`.

        vm.stopBroadcast();

        console2.log("GobbledWarplets:", address(gobbled));
        console2.log("NFTReserve:", address(reserve));
        console2.log("AuctionSell:", address(sell));
        console2.log("GobbledWarplets owner (URI / admin):", gobbled.owner());
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
