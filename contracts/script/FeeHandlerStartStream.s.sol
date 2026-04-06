// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice `FeeHandler.startStream()` — admin recomputes Superfluid flow to `auction` from handler Streme balance.
/// @dev Run **after** the handler holds Streme (transfer or `rebalance`). If `streamActive` is already true and
///      you only added balance, `rebalanceFlowRate()` is permissionless; this script uses admin `startStream`.
///
/// ```
/// forge script script/FeeHandlerStartStream.s.sol:FeeHandlerStartStream --rpc-url base --broadcast -vvv
/// ```
///
/// Required env: `FEE_HANDLER_ADDRESS`, and exactly one of `PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY` (must be
/// `FeeHandler` `DEFAULT_ADMIN_ROLE`).
contract FeeHandlerStartStream is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();
        address fh = vm.envAddress("FEE_HANDLER_ADDRESS");

        vm.startBroadcast(pk);
        FeeHandler(fh).startStream();
        vm.stopBroadcast();

        console2.log("FeeHandler.startStream() done:", fh);
    }
}
