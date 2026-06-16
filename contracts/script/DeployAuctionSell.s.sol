// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {DeployWarpletGobblerStack} from "./DeployWarpletGobblerStack.s.sol";

/// @notice Deprecated alias — use `DeployWarpletGobblerStack.s.sol` instead.
/// @dev Kept so older docs/commands keep working; runs the full stack deploy.
contract DeployAuctionSell is DeployWarpletGobblerStack {}
