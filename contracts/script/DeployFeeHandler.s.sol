// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice Deploy `FeeHandler` on Base (or any chain where env addresses are valid).
///
/// @dev **All** values below must be set in `.env` (use zero address for `REBALANCER_ADDRESS` to skip role).
/// @dev **DutchAuction wiring:** `DutchAuction` approves `_feeHandler` only in its constructor.
///      If `AUCTION_ADDRESS` is an already-live `DutchAuction` deployed with a *different* fee handler,
///      this new `FeeHandler` will not receive token allowance from that auction; fix is off-chain
///      upgrade / new auction / migration path, not this script alone.
///
/// Required env:
/// - `PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY` (exactly one)
/// - `WETH_ADDRESS`, `STREME_TOKEN_ADDRESS`, `LP_FACTORY_V4_ADDRESS`, `AUCTION_ADDRESS`,
///   `STREME_ZAP_ADDRESS`, `TARGET_DURATION_SECONDS`, `ADMIN_ADDRESS`, `REBALANCER_ADDRESS`
contract DeployFeeHandler is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();
        vm.startBroadcast(pk);

        FeeHandler handler = new FeeHandler(
            vm.envAddress("WETH_ADDRESS"),
            vm.envAddress("STREME_TOKEN_ADDRESS"),
            vm.envAddress("LP_FACTORY_V4_ADDRESS"),
            vm.envAddress("AUCTION_ADDRESS"),
            vm.envAddress("STREME_ZAP_ADDRESS"),
            vm.envUint("TARGET_DURATION_SECONDS"),
            vm.envAddress("ADMIN_ADDRESS"),
            vm.envAddress("REBALANCER_ADDRESS")
        );

        vm.stopBroadcast();

        console2.log("FeeHandler deployed at:", address(handler));
    }
}
