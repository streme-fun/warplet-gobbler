// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {MockBidToken} from "./MockBidToken.sol";

/// @notice Test double for `IStremeZapUniversal.zap` matching `FeeHandler` call shape:
///         `stremeCoin` = **out** token (`bidToken`), `amountIn` = **in** leg size (here must equal `msg.value`
///         when using native `{value: msg.value}`), `amountOutMin` = min **out** (auction bid amount),
///         `stakingContract == address(0)` → mint to `msg.sender` (the auction).
/// @dev Exchange: `amountOut = (msg.value * bidOutPerEth) / 1 ether [+ extraOut] [- shortfall]`.
///      Tests set `bidOutPerEth` so a chosen `msg.value` clears `amountOutMin` without pretending 1:1 ETH/BidToken.
contract MockBidTokenStremeZap {
    MockBidToken public immutable bidToken;

    /// @notice Bid-token wei received per 1 ether of ETH in (18-decimal fixed).
    uint256 public bidOutPerEth;

    uint256 public extraOut;
    uint256 public shortfall;

    /// @notice Lie about `amountOut` by this many bid-token wei. The mock mints the *true* amount to
    ///         the caller (subject to `extraOut` / `shortfall`) but returns `actual + overReportBy`.
    ///         Used to verify AuctionSell measures its own balance delta and ignores the return value.
    uint256 public overReportBy;

    /// @dev If false, omit `amountOut >= amountOutMin` so a defective zap can under-deliver and
    ///      `AuctionSell`’s `require(amountOut >= amount)` is tested.
    bool public enforceMinOut = true;

    address public lastStremeCoin;
    uint256 public lastAmountIn;
    uint256 public lastAmountOutMin;
    address public lastStaking;
    uint256 public lastMsgValue;

    constructor(MockBidToken _bidToken) {
        bidToken = _bidToken;
    }

    function setBidOutPerEth(uint256 _bidOutPerEth) external {
        bidOutPerEth = _bidOutPerEth;
    }

    function setExtraOut(uint256 _extra) external {
        extraOut = _extra;
    }

    function setShortfall(uint256 _shortfall) external {
        shortfall = _shortfall;
    }

    function setEnforceMinOut(bool _enforce) external {
        enforceMinOut = _enforce;
    }

    function setOverReportBy(uint256 _overReportBy) external {
        overReportBy = _overReportBy;
    }

    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract)
        external
        payable
        returns (uint256 amountOut)
    {
        lastStremeCoin = stremeCoin;
        lastAmountIn = amountIn;
        lastAmountOutMin = amountOutMin;
        lastStaking = stakingContract;
        lastMsgValue = msg.value;

        require(stremeCoin == address(bidToken), "MockZap: token");
        require(stakingContract == address(0), "MockZap: stake");
        require(amountIn == msg.value, "MockZap: amountIn != msg.value");

        uint256 delivered = (msg.value * bidOutPerEth) / 1 ether + extraOut;
        unchecked {
            if (shortfall > delivered) {
                delivered = 0;
            } else {
                delivered -= shortfall;
            }
        }
        // Mint only the *real* delivered amount; over-report by inflating the return value.
        bidToken.mint(msg.sender, delivered);
        amountOut = delivered + overReportBy;
        if (enforceMinOut) {
            require(amountOut >= amountOutMin, "MockZap: min-out");
        }
    }
}
