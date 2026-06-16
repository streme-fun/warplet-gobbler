// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IGobbledWarplets} from "./interfaces/IGobbledWarplets.sol";

/// @title GobbledWarplets
/// @notice ERC721 receipt collection for gobbled Warplets. The authorized minter reserves receipts; the
///         designated recipient claims via signed {rescueWarplet} (EIP-712 from `tokenURISetter`), which mints
///         the receipt and pulls the underlying Warplet from the auction when still held there.
/// @dev Token id encoding: `tokenId = gobbleIndex * WARPLET_ID_PADDING + warpletId`.
///      `warpletId` must be strictly less than {WARPLET_ID_PADDING} so decoding is unambiguous.
///      Padding is 1e8 (extra decimal zero vs 1e7) so sparse Warplet ids stay safely below the modulus; see `web/scripts/scan-warplet-token-ids.mjs`.
///      Uses {ERC721Enumerable} for `totalSupply`, `tokenOfOwnerByIndex`, and `tokenByIndex`.
///      The metadata-rescuing overload uses {_mint} (not {_safeMint}) so completion cannot be bricked by a
///      receiver that reverts in `onERC721Received`. No post-mint receiver callback — avoids re-entrancy issues.
///
///      {reserve}: only {minter} (typically `AuctionSell`) assigns `tokenId` → recipient; emits {Reserved}.
///      The reservation also gates {rescueWarplet}, which reads the underlying Warplet ERC721 from
///      `minter.nft()` and pulls it directly via `IERC721.transferFrom(minter, to, warpletId)` —
///      authorized by the `setApprovalForAll` AuctionSell grants this contract in its constructor.
///      The metadata-bearing overload additionally mints the receipt and sets its `tokenURI` from a
///      `Mint` EIP-712 signature by `tokenURISetter`.
/// @dev Minimal view of the AuctionSell minter that GobbledWarplets needs to pull held Warplets out of
///      the auction. AuctionSell pre-approves this contract via `setApprovalForAll` in its constructor.
interface IGobbledWarpletsMinter {
    function nft() external view returns (IERC721);
}

contract GobbledWarplets is ERC721Enumerable, ERC721URIStorage, Ownable, EIP712, IGobbledWarplets {
    bytes32 private constant _MINT_TYPEHASH = keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");

    /// @dev Gobbled `tokenId` packs `(gobbleIndex, warpletId)` as `gobbleIndex * padding + warpletId`.
    ///      Underlying Warplet ERC-721 ids must be `< padding` (same bound used in `%` / `/` decode).
    uint256 public constant WARPLET_ID_PADDING = 100_000_000;

    address public minter;

    address public tokenURISetter;

    mapping(uint256 warpletId => uint256 count) private _gobbles;

    /// @notice Recipient allowed to call {rescueWarplet} for a reserved `tokenId`. Cleared when the receipt is minted.
    mapping(uint256 tokenId => address recipient) private _reservedRecipient;

    /// @notice True once the underlying Warplet for `tokenId` has been pulled out of the auction.
    mapping(uint256 tokenId => bool) public warpletRescued;

    event MinterChanged(address indexed newMinter);

    event TokenURISetterChanged(address indexed newTokenURISetter);

    event Reserved(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    /// @notice Emitted when a winner mints the receipt with signed metadata AND pulls the underlying Warplet.
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
        require(warpletId < WARPLET_ID_PADDING, "GobbledWarplets: warpletId too large");
        uint256 gobbleIndex = _gobbles[warpletId];
        tokenId = _encodeTokenId(warpletId, gobbleIndex);
        require(_ownerOf(tokenId) == address(0), "GobbledWarplets: already minted");
        require(_reservedRecipient[tokenId] == address(0), "GobbledWarplets: already reserved");

        _gobbles[warpletId] = gobbleIndex + 1;
        _reservedRecipient[tokenId] = to;
        emit Reserved(to, warpletId, tokenId, gobbleIndex);
    }

    /// @notice Reserved recipient mints the receipt with signed metadata. If the underlying Warplet has
    ///         not yet been pulled, this also transfers it from the auction in the same transaction.
    /// @param deadline Unix timestamp after which the signature is invalid.
    function rescueWarplet(uint256 tokenId, string calldata uri, uint256 deadline, bytes calldata signature)
        external
    {
        require(block.timestamp <= deadline, "GobbledWarplets: signature expired");

        address to = _reservedRecipient[tokenId];
        require(to != address(0), "GobbledWarplets: not reserved");
        require(msg.sender == to, "GobbledWarplets: not recipient");
        require(_ownerOf(tokenId) == address(0), "GobbledWarplets: already minted");

        address signer = ECDSA.recoverCalldata(
            _hashTypedDataV4(keccak256(abi.encode(_MINT_TYPEHASH, tokenId, keccak256(bytes(uri)), deadline))),
            signature
        );
        require(signer == tokenURISetter, "GobbledWarplets: invalid signer");

        delete _reservedRecipient[tokenId];

        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);

        (uint256 wid, uint256 idx) = _decodeTokenId(tokenId);
        if (!warpletRescued[tokenId]) {
            warpletRescued[tokenId] = true;
            IERC721 warplets = IGobbledWarpletsMinter(minter).nft();
            warplets.transferFrom(minter, to, wid);
        }
        emit Minted(to, wid, tokenId, idx);
    }

    /// @notice Owner mints a gobbled receipt directly (e.g. manual migration or break-glass).
    function adminMint(address to, uint256 warpletId, string calldata uri) external onlyOwner {
        require(to != address(0), "GobbledWarplets: zero recipient");
        require(warpletId < WARPLET_ID_PADDING, "GobbledWarplets: warpletId too large");

        uint256 gobbleIndex = _gobbles[warpletId];
        uint256 tokenId = _encodeTokenId(warpletId, gobbleIndex);
        require(_ownerOf(tokenId) == address(0), "GobbledWarplets: already minted");
        require(_reservedRecipient[tokenId] == address(0), "GobbledWarplets: reserved");

        _gobbles[warpletId] = gobbleIndex + 1;

        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit Minted(to, warpletId, tokenId, gobbleIndex);
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
            return gobbleIndex * WARPLET_ID_PADDING + warpletId;
        }
    }

    function _decodeTokenId(uint256 tokenId) internal pure returns (uint256 warpletId, uint256 gobbleIndex) {
        unchecked {
            warpletId = tokenId % WARPLET_ID_PADDING;
            gobbleIndex = tokenId / WARPLET_ID_PADDING;
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
