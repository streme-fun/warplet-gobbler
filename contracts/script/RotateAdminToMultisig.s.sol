// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/Script.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {DeployHelpers} from "./DeployHelpers.sol";

/// @notice Rotate live admin roles from the deployer EOA to a multisig.
/// @dev Broadcast as the **current** admin (`DEFAULT_ADMIN_ROLE` + Ownable owner). Does **not**
///      change `GobbledWarplets.tokenURISetter` or `minter`.
///
/// Required env:
/// - `MULTISIG_ADDRESS`
/// - `FEE_HANDLER_ADDRESS`
/// - `AUCTION_SELL_ADDRESS`
/// - `GOBBLED_WARPLETS_ADDRESS`
/// - Exactly one of `PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY` (current admin EOA)
///
/// Optional env:
/// - `REBALANCER_ADDRESS` — defaults to deployer EOA (`vm.addr(pk)`)
///
/// ```
/// forge script script/RotateAdminToMultisig.s.sol:RotateAdminToMultisig --rpc-url base --broadcast -vvv
/// ```
contract RotateAdminToMultisig is DeployHelpers {
    function run() external {
        uint256 pk = _loadPrivateKey();
        address deployer = vm.addr(pk);
        address multisig = vm.envAddress("MULTISIG_ADDRESS");
        address rebalancer = deployer;
        if (vm.envExists("REBALANCER_ADDRESS")) {
            address configured = vm.envAddress("REBALANCER_ADDRESS");
            if (configured != address(0)) rebalancer = configured;
        }

        FeeHandler feeHandler = FeeHandler(vm.envAddress("FEE_HANDLER_ADDRESS"));
        AuctionSell auctionSell = AuctionSell(payable(vm.envAddress("AUCTION_SELL_ADDRESS")));
        GobbledWarplets gobbled = GobbledWarplets(vm.envAddress("GOBBLED_WARPLETS_ADDRESS"));

        require(multisig != address(0), "RotateAdminToMultisig: zero multisig");
        require(multisig != deployer, "RotateAdminToMultisig: multisig is deployer");
        require(rebalancer != address(0), "RotateAdminToMultisig: zero rebalancer");

        bytes32 adminRole = feeHandler.DEFAULT_ADMIN_ROLE();
        bytes32 rebalancerRole = feeHandler.REBALANCER_ROLE();

        require(feeHandler.hasRole(adminRole, deployer), "RotateAdminToMultisig: deployer not FeeHandler admin");
        require(auctionSell.owner() == deployer, "RotateAdminToMultisig: deployer not AuctionSell owner");
        require(gobbled.owner() == deployer, "RotateAdminToMultisig: deployer not GobbledWarplets owner");

        console2.log("deployer (current admin):", deployer);
        console2.log("multisig (new admin):", multisig);
        console2.log("rebalancer:", rebalancer);
        console2.log("FeeHandler:", address(feeHandler));
        console2.log("AuctionSell:", address(auctionSell));
        console2.log("GobbledWarplets:", address(gobbled));
        console2.log("tokenURISetter (unchanged):", gobbled.tokenURISetter());
        console2.log("minter (unchanged):", gobbled.minter());

        vm.startBroadcast(pk);

        if (!feeHandler.hasRole(adminRole, multisig)) {
            feeHandler.grantRole(adminRole, multisig);
            console2.log("Granted FeeHandler DEFAULT_ADMIN_ROLE to multisig");
        }

        if (!feeHandler.hasRole(rebalancerRole, rebalancer)) {
            feeHandler.grantRole(rebalancerRole, rebalancer);
            console2.log("Granted FeeHandler REBALANCER_ROLE to rebalancer");
        }

        if (auctionSell.owner() != multisig) {
            auctionSell.transferOwnership(multisig);
            console2.log("Transferred AuctionSell ownership to multisig");
        }

        if (gobbled.owner() != multisig) {
            gobbled.transferOwnership(multisig);
            console2.log("Transferred GobbledWarplets ownership to multisig");
        }

        if (feeHandler.hasRole(adminRole, deployer)) {
            feeHandler.renounceRole(adminRole, deployer);
            console2.log("Deployer renounced FeeHandler DEFAULT_ADMIN_ROLE");
        }

        vm.stopBroadcast();

        require(feeHandler.hasRole(adminRole, multisig), "RotateAdminToMultisig: multisig missing admin role");
        require(!feeHandler.hasRole(adminRole, deployer), "RotateAdminToMultisig: deployer still admin");
        require(auctionSell.owner() == multisig, "RotateAdminToMultisig: AuctionSell owner mismatch");
        require(gobbled.owner() == multisig, "RotateAdminToMultisig: GobbledWarplets owner mismatch");

        console2.log("Rotation complete.");
    }
}
