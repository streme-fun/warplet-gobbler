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
/// @notice ERC721 receipt collection for gobbled Warplets. The authorized minter reserves receipts; the
///         designated recipient completes the NFT with {mint} (EIP-712 from `tokenURISetter`) so the
///         final mint appears as their transaction (indexers / marketplaces).
/// @dev Token id encoding: `tokenId = gobbleIndex * TOKEN_ID_DECIMAL_STRIDE + warpletId`.
///      `warpletId` must be strictly less than {TOKEN_ID_DECIMAL_STRIDE} so decoding is unambiguous.
///      Stride is 1e8 (extra decimal zero vs 1e7) so sparse Warplet ids stay safely below the modulus; see `web/scripts/scan-warplet-token-ids.mjs`.
///      Uses {ERC721Enumerable} for `totalSupply`, `tokenOfOwnerByIndex`, and `tokenByIndex`.
///      {mint} uses {_mint} (not {_safeMint}) so completion cannot be bricked by a receiver that
///      reverts in `onERC721Received`. No post-mint receiver callback — avoids re-entrancy issues.
///
///      {reserve}: only {minter} (typically `AuctionSell`) assigns `tokenId` → recipient; emits {Reserved}.
///      Metadata is set only in {mint}: the reserved recipient submits a `Mint` EIP-712 signature from `tokenURISetter`.
contract GobbledWarplets is ERC721Enumerable, ERC721URIStorage, Ownable, EIP712, IGobbledWarplets {
    bytes32 private constant _MINT_TYPEHASH = keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");

    uint256 public constant MAX_WARPLET_ID_EXCLUSIVE = 100_000;
    uint256 public constant TOKEN_ID_DECIMAL_STRIDE = 1_000_000;

    address public minter;

    address public tokenURISetter;

    mapping(uint256 warpletId => uint256 count) private _gobbles;

    /// @notice Recipient allowed to call {mint} for a reserved `tokenId` (until minted).
    mapping(uint256 tokenId => address recipient) private _reservedRecipient;

    event MinterChanged(address indexed newMinter);

    event TokenURISetterChanged(address indexed newTokenURISetter);

    event Reserved(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    event Minted(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    modifier onlyMinter() {
        require(msg.sender == minter, "GobbledWarplets: not minter");
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
    function reserve(address to, uint256 warpletId) external onlyMinter returns (uint256 tokenId) {
        require(warpletId < MAX_WARPLET_ID_EXCLUSIVE, "GobbledWarplets: warpletId too large");
        uint256 gobbleIndex = _gobbles[warpletId];
        tokenId = _encodeTokenId(warpletId, gobbleIndex);
        require(_ownerOf(tokenId) == address(0), "GobbledWarplets: already minted");
        require(_reservedRecipient[tokenId] == address(0), "GobbledWarplets: already reserved");

        _gobbles[warpletId] = gobbleIndex + 1;
        _reservedRecipient[tokenId] = to;
        emit Reserved(to, warpletId, tokenId, gobbleIndex);
    }

    /// @notice Reserved recipient completes the ERC721 + initial signed metadata in one transaction.
    /// @param deadline Unix timestamp after which the signature is invalid.
    function mint(uint256 tokenId, string calldata uri, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "GobbledWarplets: signature expired");

        address to = _reservedRecipient[tokenId];
        require(to != address(0), "GobbledWarplets: not reserved");
        require(msg.sender == to, "GobbledWarplets: not recipient");
        require(_ownerOf(tokenId) == address(0), "GobbledWarplets: already minted");
        require(bytes(_suffixURI(tokenId)).length == 0, "GobbledWarplets: uri already set");

        address signer = ECDSA.recoverCalldata(
            _hashTypedDataV4(keccak256(abi.encode(_MINT_TYPEHASH, tokenId, keccak256(bytes(uri)), deadline))),
            signature
        );
        require(signer == tokenURISetter, "GobbledWarplets: invalid signer");

        delete _reservedRecipient[tokenId];

        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);

        (uint256 wid, uint256 idx) = _decodeTokenId(tokenId);
        emit Minted(to, wid, tokenId, idx);
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
