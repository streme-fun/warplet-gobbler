// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice Deploy `GobbledWarplets` only (receipt NFT). Broadcast + verify on Base:
/// ```
/// cd contracts && source .env
/// forge script script/DeployGobbledWarplets.s.sol:DeployGobbledWarplets \
///   --rpc-url $BASE_RPC_URL --broadcast --verify -vvvv
/// ```
/// @dev `AuctionSell` stores `gobbledWarplets` as **immutable**. Redeploying this contract does not update an
///      existing auction; deploy a new `AuctionSell` that references this address (or use `DeployAuctionSell.s.sol`
///      for a fresh pair). After deployment, the minter must be the live auction: `GobbledWarplets.setMinter`.
///
/// Required env:
/// - `PRIVATE_KEY` **xor** `DEPLOYER_PRIVATE_KEY` (see `DeployHelpers`)
/// - `GOBBLED_WARPLETS_NAME`
/// - `GOBBLED_WARPLETS_SYMBOL`
/// - `GOBBLED_WARPLETS_INITIAL_MINTER` — usually your deployer EOA until `AuctionSell` exists, then call `setMinter`.
/// - `GOBBLED_WARPLETS_TOKEN_URI_SETTER` (optional) — EIP-712 signer for `GobbledWarplets.mint`; defaults to deployer.
///
/// Verification uses `BASESCAN_API_KEY` from `foundry.toml` / `.env`.
contract DeployGobbledWarplets is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();
        address deployer = vm.addr(pk);

        string memory name_ = vm.envString("GOBBLED_WARPLETS_NAME");
        string memory symbol_ = vm.envString("GOBBLED_WARPLETS_SYMBOL");
        address minter = vm.envAddress("GOBBLED_WARPLETS_INITIAL_MINTER");
        address tokenURISetter = vm.envOr("GOBBLED_WARPLETS_TOKEN_URI_SETTER", deployer);

        vm.startBroadcast(pk);

        GobbledWarplets gobbled = new GobbledWarplets(name_, symbol_, minter, tokenURISetter);

        vm.stopBroadcast();

        console2.log("Deployer:", deployer);
        console2.log("GobbledWarplets:", address(gobbled));
        console2.log("Initial minter:", minter);
        console2.log("GobbledWarplets owner (URI / admin):", gobbled.owner());
        console2.log("WARPLET_ID_PADDING:", gobbled.WARPLET_ID_PADDING());
    }
}
