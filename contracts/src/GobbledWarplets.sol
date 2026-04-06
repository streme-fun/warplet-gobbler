// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IGobbledWarplets} from "./interfaces/IGobbledWarplets.sol";

/// @title GobbledWarplets
/// @notice ERC721 receipt collection for gobbled Warplets. Only the authorized minter may mint.
/// @dev Token id encoding: `tokenId = gobbleIndex * 10**6 + warpletId` (warplet ids must be below 100_000).
///      Uses {ERC721Enumerable} for `totalSupply`, `tokenOfOwnerByIndex`, and `tokenByIndex`.
///      Mint uses {_mint} (not {_safeMint}) so auction settlement cannot be bricked by a receiver that
///      reverts in `onERC721Received`. No post-mint receiver callback — avoids re-entrancy in the middle
///      of `AuctionSell` settlement (after `settled` is written) and matches common auction-house practice.
///
///      URI updates: only the configured {tokenURISetter} may set metadata via {setTokenURI} or
///      {batchSetTokenURI} (including **before** mint so the receipt is born with metadata already stored).
///      The owner sets that address via {setTokenURISetter} (same pattern as {setMinter}).
///      Anyone may call {setTokenURIWithSig} with an EIP-712 signature from `tokenURISetter`; that path
///      only works while the stored per-token URI is still empty (`tokenId` scopes one signed init).
///      Default {tokenURI} only resolves after mint; URIs may still be written early into storage.
contract GobbledWarplets is ERC721Enumerable, ERC721URIStorage, Ownable, EIP712, IGobbledWarplets {
    bytes32 private constant _SET_TOKEN_URI_TYPEHASH =
        keccak256("SetTokenURI(uint256 tokenId,string uri,uint256 deadline)");

    uint256 public constant MAX_WARPLET_ID_EXCLUSIVE = 100_000;
    uint256 public constant TOKEN_ID_DECIMAL_STRIDE = 1_000_000;

    address public minter;

    address public tokenURISetter;

    mapping(uint256 warpletId => uint256 count) private _gobbles;

    event MinterChanged(address indexed newMinter);

    event TokenURISetterChanged(address indexed newTokenURISetter);

    event Minted(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    modifier onlyMinter() {
        require(msg.sender == minter, "GobbledWarplets: not minter");
        _;
    }

    modifier onlyTokenURISetter() {
        require(msg.sender == tokenURISetter, "GobbledWarplets: not token URI setter");
        _;
    }

    constructor(string memory name_, string memory symbol_, address initialMinter, address initialTokenURISetter)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
        EIP712(name_, "1")
    {
        require(initialMinter != address(0), "GobbledWarplets: zero minter");
        require(initialTokenURISetter != address(0), "GobbledWarplets: zero token URI setter");
        minter = initialMinter;
        tokenURISetter = initialTokenURISetter;
        emit MinterChanged(initialMinter);
        emit TokenURISetterChanged(initialTokenURISetter);
    }

    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "GobbledWarplets: zero minter");
        minter = newMinter;
        emit MinterChanged(newMinter);
    }

    function setTokenURISetter(address newTokenURISetter) external onlyOwner {
        require(newTokenURISetter != address(0), "GobbledWarplets: zero token URI setter");
        tokenURISetter = newTokenURISetter;
        emit TokenURISetterChanged(newTokenURISetter);
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

    /// @notice Token URI setter may set or override URI for a token id (minted or not yet minted).
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyTokenURISetter {
        _setTokenURI(tokenId, uri);
    }

    /// @notice Callable by any address if `signature` is valid EIP-712 from {tokenURISetter}.
    ///         Only succeeds while no URI is stored yet for `tokenId` (uses {_suffixURI}, not {tokenURI},
    ///         so this still works before mint). After that, use {setTokenURI} as admin.
    /// @param deadline Unix timestamp after which the signature is invalid.
    function setTokenURIWithSig(uint256 tokenId, string calldata uri, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "GobbledWarplets: signature expired");
        require(bytes(_suffixURI(tokenId)).length == 0, "GobbledWarplets: uri already set");

        address signer = ECDSA.recoverCalldata(
            _hashTypedDataV4(
                keccak256(abi.encode(_SET_TOKEN_URI_TYPEHASH, tokenId, keccak256(bytes(uri)), deadline))
            ),
            signature
        );
        require(signer == tokenURISetter, "GobbledWarplets: invalid signer");

        _setTokenURI(tokenId, uri);
    }

    function batchSetTokenURI(uint256[] calldata tokenIds, string[] calldata uris)
        external
        onlyTokenURISetter
    {
        require(tokenIds.length == uris.length, "GobbledWarplets: length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage, ERC721) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}
