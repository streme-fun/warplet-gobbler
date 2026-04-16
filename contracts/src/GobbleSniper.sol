// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ─── External interfaces ─────────────────────────────────────────────

interface IDutchAuctionV2 {
    function gobbleFlash(uint256 tokenId, uint256 minPrice) external;
    function nftReserve() external view returns (address);
}

interface IERC777Recipient {
    function tokensReceived(
        address operator, address from, address to,
        uint256 amount, bytes calldata userData, bytes calldata operatorData
    ) external;
}

// ─── Minimal Uniswap V4 interfaces ──────────────────────────────────

type Currency is address;
type BalanceDelta is int256;

struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
    function unlock(bytes calldata data) external returns (bytes memory);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external returns (BalanceDelta);
    function sync(Currency currency) external;
    function settle() external payable returns (uint256);
    function take(Currency currency, address to, uint256 amount) external;
}

interface IWETH {
    function withdraw(uint256 wad) external;
}

// ─── GobbleSniper ────────────────────────────────────────────────────

/// @title GobbleSniper — Flash-gobble arbitrage
/// @notice Calls `gobbleFlash` on DutchAuctionV2 to receive WARPGOBB with zero upfront capital,
///         swaps to WETH, buys the Warplet on Seaport, delivers it to nftReserve — all atomic.
///         Reverts the entire tx if the result isn't profitable.
/// @dev    Uses EIP-1153 transient storage (tstore/tload) to pass state from `snipe` into the
///         ERC-777 `tokensReceived` callback without paying SSTORE gas.
contract GobbleSniper is IERC777Recipient, IERC721Receiver {
    using SafeERC20 for IERC20;

    // ── Constants ────────────────────────────────────────────────────
    uint160 internal constant MIN_SQRT_PRICE = 4295128739;
    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;

    // Transient storage slot layout (EIP-1153).
    uint256 private constant _TSLOT_IN_SNIPE        = 0x01;
    uint256 private constant _TSLOT_ETH_FOR_NFT     = 0x02;
    uint256 private constant _TSLOT_LAST_PAYOUT     = 0x03;
    uint256 private constant _TSLOT_SEAPORT_LEN     = 0x04;
    // Seaport calldata chunks start here (one 32-byte word per slot).
    uint256 private constant _TSLOT_SEAPORT_BASE    = 0x10;

    // ── Immutables ───────────────────────────────────────────────────
    address public immutable recipient;
    IERC721 public immutable warplets;
    IDutchAuctionV2 public immutable gobbler;
    IERC20 public immutable warpgobb;
    IWETH public immutable weth;
    IPoolManager public immutable poolManager;
    address public immutable seaport;
    address public immutable nftReserve;
    bool public immutable warpgobbIsCurrency0;

    // ── Pool config ──────────────────────────────────────────────────
    PoolKey public poolKey;

    // ── Events ───────────────────────────────────────────────────────
    event Sniped(uint256 indexed tokenId, uint256 payout, uint256 profit);

    constructor(
        address _warplets,
        address _gobbler,
        address _warpgobb,
        address _weth,
        address _poolManager,
        address _seaport,
        PoolKey memory _poolKey,
        address _recipient
    ) {
        recipient = _recipient == address(0) ? msg.sender : _recipient;
        warplets = IERC721(_warplets);
        gobbler = IDutchAuctionV2(_gobbler);
        warpgobb = IERC20(_warpgobb);
        weth = IWETH(_weth);
        poolManager = IPoolManager(_poolManager);
        seaport = _seaport;
        poolKey = _poolKey;
        warpgobbIsCurrency0 = _warpgobb < _weth;
        nftReserve = IDutchAuctionV2(_gobbler).nftReserve();
    }

    // ─────────────────────────────────────────────────────────────────
    //  Entry point
    // ─────────────────────────────────────────────────────────────────

    /// @notice Execute an atomic flash-gobble arbitrage. Zero upfront ETH needed.
    ///         Anyone can call. Profits always go to `recipient`.
    /// @param tokenId          Warplet token ID to gobble.
    /// @param seaportCalldata_ Seaport fulfillment calldata (from OpenSea API).
    /// @param ethForNft_       ETH value for the Seaport call (funded by the WARPGOBB swap).
    /// @param minGobblePayout  Minimum $WARPGOBB payout or the gobbler reverts early.
    /// @param minProfitWei     Minimum net ETH profit or the tx reverts at the end.
    function snipe(
        uint256 tokenId,
        bytes calldata seaportCalldata_,
        uint256 ethForNft_,
        uint256 minGobblePayout,
        uint256 minProfitWei
    ) external {
        uint256 startBalance = address(this).balance;

        // Stash Seaport params in transient storage for the `tokensReceived` callback.
        _setTransient(_TSLOT_IN_SNIPE, 1);
        _setTransient(_TSLOT_ETH_FOR_NFT, ethForNft_);
        _storeTransientBytes(seaportCalldata_);

        // Triggers: WARPGOBB send → tokensReceived → swap → buy → deliver
        gobbler.gobbleFlash(tokenId, minGobblePayout);

        // Transient storage auto-clears at tx end. Still clear the flag for sanity
        // in case of same-tx re-entry from upstream callers.
        _setTransient(_TSLOT_IN_SNIPE, 0);

        // Profit check
        uint256 profit = address(this).balance - startBalance;
        require(profit >= minProfitWei, "Not profitable");

        // Send profit to recipient
        if (address(this).balance > 0) {
            (bool ok,) = recipient.call{value: address(this).balance}("");
            require(ok, "ETH send failed");
        }

        emit Sniped(tokenId, _getTransient(_TSLOT_LAST_PAYOUT), profit);
    }

    // ─────────────────────────────────────────────────────────────────
    //  ERC-777 callback: the actual arb logic
    // ─────────────────────────────────────────────────────────────────

    /// @dev Called by WARPGOBB token during `send` from DutchAuctionV2.
    ///      1. Swap WARPGOBB → WETH via V4
    ///      2. Unwrap WETH → ETH
    ///      3. Buy Warplet on Seaport with ETH
    ///      4. Deliver Warplet to nftReserve
    function tokensReceived(
        address, address from, address,
        uint256 amount,
        bytes calldata userData,
        bytes calldata
    ) external override {
        // Defense-in-depth: only the WARPGOBB token can invoke this, only during an active snipe,
        // and only when forwarded from our trusted gobbler.
        require(msg.sender == address(warpgobb), "not warpgobb");
        require(from == address(gobbler), "not from gobbler");
        require(_getTransient(_TSLOT_IN_SNIPE) == 1, "not in snipe");

        uint256 tokenId = abi.decode(userData, (uint256));

        // Record payout for the Sniped event
        _setTransient(_TSLOT_LAST_PAYOUT, amount);

        // 1. Swap WARPGOBB → WETH
        _swapExactInput(amount);

        // 2. Unwrap WETH → ETH
        uint256 wethBal = IERC20(address(weth)).balanceOf(address(this));
        if (wethBal > 0) weth.withdraw(wethBal);

        // 3. Buy Warplet on Seaport
        uint256 ethForNft = _getTransient(_TSLOT_ETH_FOR_NFT);
        bytes memory seaportCalldata_ = _loadTransientBytes();
        (bool ok,) = seaport.call{value: ethForNft}(seaportCalldata_);
        require(ok, "Seaport buy failed");

        // 4. Deliver to nftReserve (safeTransferFrom so AuctionSell enqueues it)
        warplets.safeTransferFrom(address(this), nftReserve, tokenId);
    }

    // ─────────────────────────────────────────────────────────────────
    //  V4 swap via PoolManager.unlock callback
    // ─────────────────────────────────────────────────────────────────

    function _swapExactInput(uint256 amountIn) internal {
        poolManager.unlock(abi.encode(amountIn));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "not PM");

        uint256 amountIn = abi.decode(data, (uint256));
        bool zeroForOne = warpgobbIsCurrency0;

        BalanceDelta delta = poolManager.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE + 1 : MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int128 amount0 = int128(int256(BalanceDelta.unwrap(delta) >> 128));
        int128 amount1 = int128(int256(BalanceDelta.unwrap(delta)));

        // Settle: pay WARPGOBB, take WETH
        uint256 owed;
        uint256 received;
        if (zeroForOne) {
            owed = uint256(uint128(amount0 > 0 ? amount0 : -amount0));
            received = uint256(uint128(amount1 > 0 ? amount1 : -amount1));
        } else {
            owed = uint256(uint128(amount1 > 0 ? amount1 : -amount1));
            received = uint256(uint128(amount0 > 0 ? amount0 : -amount0));
        }

        poolManager.sync(Currency.wrap(address(warpgobb)));
        warpgobb.safeTransfer(address(poolManager), owed);
        poolManager.settle();
        poolManager.take(Currency.wrap(address(weth)), address(this), received);

        return "";
    }

    // ─────────────────────────────────────────────────────────────────
    //  Transient storage helpers (EIP-1153)
    // ─────────────────────────────────────────────────────────────────

    function _setTransient(uint256 slot, uint256 value) private {
        assembly { tstore(slot, value) }
    }

    function _getTransient(uint256 slot) private view returns (uint256 v) {
        assembly { v := tload(slot) }
    }

    /// @dev Store variable-length bytes in transient storage as length + 32-byte chunks.
    function _storeTransientBytes(bytes calldata data) private {
        uint256 len = data.length;
        uint256 base = _TSLOT_SEAPORT_BASE;
        assembly {
            tstore(_TSLOT_SEAPORT_LEN, len)
            // Copy calldata into transient storage, 32 bytes per slot.
            let end := add(len, 31)
            let chunks := div(end, 32)
            for { let i := 0 } lt(i, chunks) { i := add(i, 1) } {
                tstore(add(base, i), calldataload(add(data.offset, mul(i, 32))))
            }
        }
    }

    function _loadTransientBytes() private view returns (bytes memory out) {
        uint256 len;
        assembly { len := tload(_TSLOT_SEAPORT_LEN) }
        out = new bytes(len);
        uint256 base = _TSLOT_SEAPORT_BASE;
        assembly {
            let end := add(len, 31)
            let chunks := div(end, 32)
            let ptr := add(out, 32)
            for { let i := 0 } lt(i, chunks) { i := add(i, 1) } {
                mstore(add(ptr, mul(i, 32)), tload(add(base, i)))
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  Admin — permissionless sweeps, hardcoded to `recipient`
    // ─────────────────────────────────────────────────────────────────

    /// @notice Sweep all ETH to `recipient`. Permissionless.
    function withdraw() external {
        (bool ok,) = recipient.call{value: address(this).balance}("");
        require(ok);
    }

    /// @notice Sweep an ERC-20 token to `recipient`. Permissionless.
    function withdrawToken(address token) external {
        IERC20(token).safeTransfer(recipient, IERC20(token).balanceOf(address(this)));
    }

    /// @notice Sweep an ERC-721 to `recipient`. Permissionless.
    function withdrawNft(address token, uint256 tokenId) external {
        IERC721(token).safeTransferFrom(address(this), recipient, tokenId);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Receive hooks
    // ─────────────────────────────────────────────────────────────────

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
