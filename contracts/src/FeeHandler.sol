// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import {SuperTokenV1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";

interface ILPFactoryv4 {
    function claimRewards(address token) external;
}

/// @dev Streme `StremeZapUniversal.swapTokenForStreme` — v4 single-hop swap into `stremeCoin`.
interface IStremeZapUniversal {
    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract)
        external
        payable
        returns (uint256 amountOut);
}

/// @title FeeHandler
/// @notice Collects locker fees (weth + token), swaps weth via `StremeZapUniversal`, streams streme to the auction.
/// @dev `DEFAULT_ADMIN_ROLE` configures auction/stream settings. `REBALANCER_ROLE` may call `rebalance` and `rebalanceFlowRate`.
contract FeeHandler is AccessControl {
    using SafeERC20 for IERC20;
    using SuperTokenV1Library for ISuperToken;

    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    uint256 public immutable MIN_TOKEN_OUT;

    IERC20 public immutable weth;
    ISuperToken public immutable stremeToken;
    ILPFactoryv4 public immutable lpFactory;

    address public auction;
    /// @notice Streme universal zap — performs v4 `weth` -> `stremeToken` swap into this contract.
    IStremeZapUniversal public immutable stremeZap;

    bool public streamActive;

    /// @notice Number of seconds used for flow-rate targeting: flowRate = balance / targetDuration.
    uint256 public targetDuration;

    event WethSwapped(address indexed zap, uint256 wethIn, uint256 tokenOut);
    event RewardsClaimedAndSwapped(
        address indexed caller,
        uint256 wethClaimed,
        uint256 wethSwapped,
        uint256 stremeOut
    );
    event AuctionUpdated(address indexed oldAuction, address indexed newAuction);
    event TargetDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event FlowRateRebalanced(address indexed auction, int96 flowRate);

    error ZeroAddress();
    error InvalidDuration();
    error StreamNotActive();
    error FlowRateTooHigh();
    error AmountInTooLarge();
    error IdenticalPoolCurrencies();
    error UnauthorizedRebalance();

    constructor(
        address _weth,
        address _stremeToken,
        address _lpFactory,
        address _auction,
        address _stremeZap,
        uint256 _targetDuration,
        address _admin,
        address _rebalancer,
        uint256 _minTokenOut
    ) {
        if (
            _weth == address(0) || _stremeToken == address(0) || _lpFactory == address(0)
                || _auction == address(0) || _stremeZap == address(0) || _admin == address(0)
        ) revert ZeroAddress();
        if (_weth == _stremeToken) revert IdenticalPoolCurrencies();
        if (_targetDuration == 0) revert InvalidDuration();

        weth = IERC20(_weth);
        stremeToken = ISuperToken(_stremeToken);
        lpFactory = ILPFactoryv4(_lpFactory);
        auction = _auction;
        stremeZap = IStremeZapUniversal(_stremeZap);
        targetDuration = _targetDuration;
        streamActive = true;
        MIN_TOKEN_OUT = _minTokenOut; // set to 20_000_000 * 1e18

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        if (_rebalancer != address(0)) {
            _grantRole(REBALANCER_ROLE, _rebalancer);
        }

        weth.forceApprove(address(stremeZap), type(uint256).max);
    }

    modifier onlyRebalancerOrAdmin() {
        if (!hasRole(REBALANCER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedRebalance();
        }
        _;
    }

    /// @notice Updates auction endpoint; used to migrate stream destination.
    /// automatically stops stream to old auction. New stream must be done manually.
    function setAuction(address newAuction) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newAuction == address(0)) revert ZeroAddress();

        address oldAuction = auction;
        if (stremeToken.getFlowRate(address(this), oldAuction) > 0) {
            stremeToken.flow(oldAuction, int96(0));
        }
        uint256 balance = stremeToken.balanceOf(oldAuction);
        if (balance > 0) stremeToken.transferFrom(oldAuction, address(this), balance);
        auction = newAuction;
        streamActive = false;
        emit AuctionUpdated(oldAuction, newAuction);
    }

    function setTargetDuration(uint256 newDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newDuration == 0) revert InvalidDuration();
        uint256 old = targetDuration;
        targetDuration = newDuration;
        emit TargetDurationUpdated(old, newDuration);
    }

    /// @notice Start streaming to current auction address.
    function startStream() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _rebalanceFlowRate();
        streamActive = true;
    }

    /// @notice Claim rewards, swap weth to streme (no `minTokenOut`), then update the auction stream rate.
    function rebalance() external onlyRebalancerOrAdmin {
        _claimRewardsAndSwapWethToToken(0);
        _rebalanceFlowRate();
    }

    /// @notice Anyone can rebalance flow rate from current weth balance.
    function rebalanceFlowRate() external {
        if (!streamActive) revert StreamNotActive();
        _rebalanceFlowRate();
    }

    function _rebalanceFlowRate() internal {
        int96 nextRate = _computeFlowRate();
        stremeToken.flow(auction, nextRate);
        emit FlowRateRebalanced(auction, nextRate);
    }

    /// @notice Permissionless harvest path: claim rewards from LP factory, then swap all weth to streme.
    function claimRewardsAndSwapWethToToken() external {
        _claimRewardsAndSwapWethToToken(MIN_TOKEN_OUT);
    }

    function _claimRewardsAndSwapWethToToken(uint256 minTokenOut) internal {
        uint256 wethBeforeClaim = weth.balanceOf(address(this));
        lpFactory.claimRewards(address(stremeToken));
        uint256 wethAfterClaim = weth.balanceOf(address(this));
        uint256 wethClaimed = wethAfterClaim - wethBeforeClaim;

        uint256 stremeBeforeSwap = stremeToken.balanceOf(address(this));
        uint256 wethBeforeSwap = weth.balanceOf(address(this));

        if (wethBeforeSwap > 0) {
            _swapWethToToken(wethBeforeSwap, stremeBeforeSwap, minTokenOut);
        }

        uint256 wethSwapped = wethBeforeSwap - weth.balanceOf(address(this));
        uint256 stremeOut = stremeToken.balanceOf(address(this)) - stremeBeforeSwap;
        emit RewardsClaimedAndSwapped(msg.sender, wethClaimed, wethSwapped, stremeOut);
    }

    function _swapWethToToken(uint256 wethBefore, uint256 tokenBefore, uint256 minTokenOut) internal {
        if (wethBefore > type(uint128).max) revert AmountInTooLarge();
        stremeZap.zap(address(stremeToken), uint256(wethBefore), minTokenOut, address(this)){value: 0};
        uint256 wethIn = wethBefore - weth.balanceOf(address(this));
        uint256 tokenOut = stremeToken.balanceOf(address(this)) - tokenBefore;
        emit WethSwapped(address(stremeZap), wethIn, tokenOut);
    }

    function previewFlowRate() external view returns (int96) {
        return _computeFlowRate();
    }

    function currentFlowRate() external view returns (int96) {
        return stremeToken.getFlowRate(address(this), auction);
    }

    function _computeFlowRate() internal view returns (int96) {
        uint256 bal = stremeToken.balanceOf(address(this));
        uint256 rawRate = bal / targetDuration;
        if (rawRate > uint256(int256(type(int96).max))) revert FlowRateTooHigh();
        return int96(int256(rawRate));
    }
}
