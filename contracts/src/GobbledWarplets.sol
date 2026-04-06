// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGobbledWarplets} from "./interfaces/IGobbledWarplets.sol";

/// @title GobbledWarplets
/// @notice ERC721 receipt collection for gobbled Warplets. Only the authorized minter may mint.
/// @dev Token id encoding: `tokenId = gobbleIndex * TOKEN_ID_DECIMAL_STRIDE + warpletId`.
///      `warpletId` must be strictly less than {TOKEN_ID_DECIMAL_STRIDE} so decoding is unambiguous.
///      Stride is 1e8 (extra decimal zero vs 1e7) so sparse Warplet ids stay safely below the modulus; see `web/scripts/scan-warplet-token-ids.mjs`.
///      Uses {ERC721Enumerable} for `totalSupply`, `tokenOfOwnerByIndex`, and `tokenByIndex`.
///      Mint uses {_mint} (not {_safeMint}) so auction settlement cannot be bricked by a receiver that
///      reverts in `onERC721Received`. No post-mint receiver callback — avoids re-entrancy in the middle
///      of `AuctionSell` settlement (after `settled` is written) and matches common auction-house practice.
contract GobbledWarplets is ERC721Enumerable, ERC721URIStorage, Ownable, IGobbledWarplets {
    uint256 public constant TOKEN_ID_DECIMAL_STRIDE = 100_000_000;
    /// @dev Must match {TOKEN_ID_DECIMAL_STRIDE}: decode uses `% stride`, so `warpletId` must be `< stride`.
    ///      Intentionally looser than the historical 100k cap — Warplet ids are sparse on-chain and this avoids false
    ///      rejects; confirm max id with `web/scripts/scan-warplet-token-ids.mjs` before relying on headroom.
    uint256 public constant MAX_WARPLET_ID_EXCLUSIVE = TOKEN_ID_DECIMAL_STRIDE;

    address public minter;

    event MinterChanged(address indexed newMinter);
    event Minted(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    mapping(uint256 warpletId => uint256 count) private _gobbles;

    modifier onlyMinter() {
        require(msg.sender == minter, "GobbledWarplets: not minter");
        _;
    }

    constructor(string memory name_, string memory symbol_, address initialMinter) ERC721(name_, symbol_) Ownable(msg.sender) {
        require(initialMinter != address(0), "GobbledWarplets: zero minter");
        minter = initialMinter;
        emit MinterChanged(initialMinter);
    }

    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "GobbledWarplets: zero minter");
        minter = newMinter;
        emit MinterChanged(newMinter);
    }

    /// @inheritdoc IGobbledWarplets
    function mint(address to, uint256 warpletId) external onlyMinter returns (uint256 tokenId) {
        require(warpletId < MAX_WARPLET_ID_EXCLUSIVE, "GobbledWarplets: warpletId too large");
        uint256 gobbleIndex = _gobbles[warpletId];
        tokenId = _encodeTokenId(warpletId, gobbleIndex);
        require(_ownerOf(tokenId) == address(0), "GobbledWarplets: already minted");

        _gobbles[warpletId] = gobbleIndex + 1;
        _mint(to, tokenId);
        emit Minted(to, warpletId, tokenId, gobbleIndex);
    }

    /// @notice Owner may set URI anytime; token owner may set only while URI is still empty.
    function setTokenURI(uint256 tokenId, string calldata uri) external {
        address tokenOwner = _ownerOf(tokenId);
        require(tokenOwner != address(0), "GobbledWarplets: nonexistent token");

        bool isAdmin = msg.sender == owner();
        bool isTokenOwnerAndUnset = (msg.sender == tokenOwner) && (bytes(tokenURI(tokenId)).length == 0);
        require(isAdmin || isTokenOwnerAndUnset, "GobbledWarplets: not authorized");

        _setTokenURI(tokenId, uri);
    }

    function batchSetTokenURI(uint256[] calldata tokenIds, string[] calldata uris) external onlyOwner {
        require(tokenIds.length == uris.length, "GobbledWarplets: length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_ownerOf(tokenIds[i]) != address(0), "GobbledWarplets: nonexistent token");
            _setTokenURI(tokenIds[i], uris[i]);
        }
    }

    function gobbleCount(uint256 warpletId) external view returns (uint256) {
        return _gobbles[warpletId];
    }

    function warpletOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "GobbledWarplets: nonexistent token");
        (uint256 wid,) = _decodeTokenId(tokenId);
        return wid;
    }

    function gobbleIndexOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "GobbledWarplets: nonexistent token");
        (, uint256 idx) = _decodeTokenId(tokenId);
        return idx;
    }

    function _encodeTokenId(uint256 warpletId, uint256 gobbleIndex) internal pure returns (uint256) {
        unchecked {
            return gobbleIndex * TOKEN_ID_DECIMAL_STRIDE + warpletId;
        }
    }

    function _decodeTokenId(uint256 tokenId) internal pure returns (uint256 warpletId, uint256 gobbleIndex) {
        unchecked {
            warpletId = tokenId % TOKEN_ID_DECIMAL_STRIDE;
            gobbleIndex = tokenId / TOKEN_ID_DECIMAL_STRIDE;
        }
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721Enumerable, ERC721) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721Enumerable, ERC721) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage, ERC721) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}
