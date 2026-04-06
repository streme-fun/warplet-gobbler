// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IMulticall3 {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }
    struct Result {
        bool success;
        bytes returnData;
    }
    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData);
}

// Multicall3 on Base (and most EVM chains).
address constant MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;

/// @notice Enumerate every minted token id on an ERC721Enumerable collection (e.g. Warplets on Base).
/// @dev Uses Multicall3 to batch `tokenByIndex` reads. All configuration comes from env (no defaults).
///
/// Required env:
/// - `WARPLETS_NFT_ADDRESS`
/// - `SCAN_LEGACY_MAX_EXCLUSIVE` — count ids `>=` this
/// - `SCAN_GOBBLED_MAX_EXCLUSIVE` — count ids `>=` this (e.g. `TOKEN_ID_DECIMAL_STRIDE` from `GobbledWarplets`)
/// - `SCAN_MULTICALL_BATCH` — sub-calls per `aggregate3` (e.g. 400)
///
/// ```
/// forge script script/ScanWarpletTokenIds.s.sol:ScanWarpletTokenIds --sig "run()" -vv --rpc-url $BASE_RPC_URL
/// ```
/// Forge forks chain state; for HTTP-only multicall use `web/scripts/scan-warplet-token-ids.mjs`.
contract ScanWarpletTokenIds is Script {
    function run() external {
        address nft = vm.envAddress("WARPLETS_NFT_ADDRESS");
        uint256 legacyCap = vm.envUint("SCAN_LEGACY_MAX_EXCLUSIVE");
        uint256 encodeMax = vm.envUint("SCAN_GOBBLED_MAX_EXCLUSIVE");
        uint256 batchSize = vm.envUint("SCAN_MULTICALL_BATCH");

        uint256 supply = IERC721Enumerable(nft).totalSupply();
        (uint256 minId, uint256 maxId, uint256 gteLegacy, uint256 gteEncode) =
            _scanBatched(nft, supply, legacyCap, encodeMax, batchSize);

        console2.log("Warplets contract:", nft);
        console2.log("totalSupply:", supply);
        console2.log("min tokenId:", minId);
        console2.log("max tokenId:", maxId);
        console2.log("count id >= SCAN_LEGACY_MAX_EXCLUSIVE:", gteLegacy);
        console2.log("count id >= SCAN_GOBBLED_MAX_EXCLUSIVE:", gteEncode);
    }

    function _scanBatched(
        address nft,
        uint256 supply,
        uint256 legacyCap,
        uint256 encodeMax,
        uint256 batchSize
    ) internal returns (uint256 minId, uint256 maxId, uint256 gteLegacy, uint256 gteEncode) {
        minId = type(uint256).max;
        bytes4 sel = IERC721Enumerable.tokenByIndex.selector;
        IMulticall3 mc = IMulticall3(MULTICALL3);

        for (uint256 start = 0; start < supply; start += batchSize) {
            uint256 end = start + batchSize;
            if (end > supply) end = supply;

            IMulticall3.Call3[] memory calls = _buildCalls(nft, sel, start, end);
            IMulticall3.Result[] memory results = mc.aggregate3(calls);

            for (uint256 j = 0; j < results.length; j++) {
                require(results[j].success, "ScanWarpletTokenIds: tokenByIndex failed");
                uint256 id = abi.decode(results[j].returnData, (uint256));
                if (id < minId) minId = id;
                if (id > maxId) maxId = id;
                if (id >= legacyCap) gteLegacy++;
                if (id >= encodeMax) gteEncode++;
            }
        }
    }

    function _buildCalls(address nft, bytes4 sel, uint256 start, uint256 end)
        internal
        pure
        returns (IMulticall3.Call3[] memory calls)
    {
        uint256 n = end - start;
        calls = new IMulticall3.Call3[](n);
        for (uint256 j = 0; j < n; j++) {
            calls[j] = IMulticall3.Call3(nft, false, abi.encodeWithSelector(sel, start + j));
        }
    }
}
