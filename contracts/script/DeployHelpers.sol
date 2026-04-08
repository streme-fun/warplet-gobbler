// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";

/// @dev Loads the deployer key from `.env`: **exactly one** of `PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY`
///      must be set (non-empty hex). No fallback between scripts’ other variables.
abstract contract DeployHelpers is Script {
    function _loadPrivateKey() internal view returns (uint256 pk) {
        bool hasPriv = vm.envExists("PRIVATE_KEY");
        bool hasDep = vm.envExists("DEPLOYER_PRIVATE_KEY");
        require(hasPriv != hasDep, "DeployHelpers: set exactly one of PRIVATE_KEY or DEPLOYER_PRIVATE_KEY");

        if (hasPriv) {
            string memory s = vm.envString("PRIVATE_KEY");
            require(bytes(s).length > 0, "DeployHelpers: PRIVATE_KEY empty");
            return vm.parseUint(s);
        }
        string memory s2 = vm.envString("DEPLOYER_PRIVATE_KEY");
        require(bytes(s2).length > 0, "DeployHelpers: DEPLOYER_PRIVATE_KEY empty");
        return vm.parseUint(s2);
    }
}
