// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title StratStaking
/// @notice Stake $STRAT tokens to earn $STRAT from auction proceeds.
/// @dev TODO: Decide on staking model:
///      - Simple proportional share of auction proceeds?
///      - Superfluid streaming rewards?
///      - Lock period or liquid staking?
contract StratStaking {
    // address public immutable stratToken;

    function stake(uint256 /* amount */) external {
        revert("not implemented");
    }

    function unstake(uint256 /* amount */) external {
        revert("not implemented");
    }

    function claimRewards() external {
        revert("not implemented");
    }

    /// @notice Called by AuctionSell to deposit $STRAT proceeds
    function depositRewards(uint256 /* amount */) external {
        revert("not implemented");
    }
}
