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
import {INFTReserve} from "./interfaces/INFTReserve.sol";

/// @title GobbledWarplets
/// @notice ERC721 receipt collection for gobbled Warplets. The authorized NFT reserve reserves receipts; the
///         designated recipient later either walks away with just the underlying Warplet via
///         {rescueWarplet}, or claims the receipt with signed metadata AND the underlying Warplet in one
///         tx via the overloaded {rescueWarplet} (EIP-712 from `tokenURISetter`) so the receipt mint
///         appears as their transaction (indexers / marketplaces).
/// @dev Token id encoding: `tokenId = gobbleIndex * WARPLET_ID_PADDING + warpletId`.
///      `warpletId` must be strictly less than {WARPLET_ID_PADDING} so decoding is unambiguous.
///      Padding is 1e8 (extra decimal zero vs 1e7) so sparse Warplet ids stay safely below the modulus; see `web/scripts/scan-warplet-token-ids.mjs`.
///      Uses {ERC721Enumerable} for `totalSupply`, `tokenOfOwnerByIndex`, and `tokenByIndex`.
///      The metadata-rescuing overload uses {_mint} (not {_safeMint}) so completion cannot be bricked by a
///      receiver that reverts in `onERC721Received`. No post-mint receiver callback — avoids re-entrancy issues.
///
///      {createReceipt}: only {auction} (e.g. `AuctionSell`) reserves `tokenId` → recipient; emits {Reserved}.
///      {rescueWarplet} reads the underlying Warplet ERC721 from `nftReserve.nft()` and pulls it via
///      `IERC721.transferFrom(nftReserve, to, warpletId)` — authorized by the `setApprovalForAll` the
///      reserve grants this contract. The metadata-bearing overload additionally mints the receipt and sets its
///      `tokenURI` from a `Mint` EIP-712 signature by `tokenURISetter`.

contract GobbledWarplets is ERC721Enumerable, ERC721URIStorage, Ownable, EIP712, IGobbledWarplets {
    bytes32 private constant _MINT_TYPEHASH = keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");

    /// @dev Gobbled `tokenId` packs `(gobbleIndex, warpletId)` as `gobbleIndex * padding + warpletId`.
    ///      Underlying Warplet ERC-721 ids must be `< padding` (same bound used in `%` / `/` decode).
    uint256 public constant WARPLET_ID_PADDING = 100_000_000;

    address public immutable nftReserve;
    address public auction;

    address public tokenURISetter;
    IERC721 public immutable warplets;

    mapping(uint256 warpletId => uint256 count) private _gobbles;

    /// @notice Recipient allowed to call {rescueWarplet} for a reserved `tokenId`. Cleared once the
    ///         metadata-bearing overload mints the receipt; the bare overload leaves it set so the
    ///         recipient can still come back later and mint the receipt with metadata.
    mapping(uint256 tokenId => address recipient) private _reservedRecipient;

    /// @notice True once the underlying Warplet for `tokenId` has been pulled out of the auction (by
    ///         either {rescueWarplet} overload). Used to make the metadata overload skip the second
    ///         transfer if the bare overload was called first.
    mapping(uint256 tokenId => bool) public warpletRescued;

    event TokenURISetterChanged(address indexed newTokenURISetter);

    event Reserved(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    /// @notice Emitted when a winner pulls the underlying Warplet without minting the receipt. The receipt
    ///         id `tokenId` is permanently burned (no future receipt can ever be minted for that slot).
    event WarpletRescued(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    /// @notice Emitted when a winner mints the receipt with signed metadata AND pulls the underlying Warplet.
    event Minted(address indexed to, uint256 indexed warpletId, uint256 indexed tokenId, uint256 gobbleIndex);

    event AuctionUpdated(address indexed newAuction);

    modifier onlyAuction() {
        require(msg.sender == auction, "GobbledWarplets: not auction");
        _;
    }

    modifier onlyReserve() {
        require(msg.sender == nftReserve, "GobbledWarplets: not reserve");
        _;
    }

    constructor(string memory name_, string memory symbol_, address _nftReserve, address initialTokenURISetter)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
        EIP712(name_, "1")
    {
        require(_nftReserve != address(0), "GobbledWarplets: zero reserve");
        require(initialTokenURISetter != address(0), "GobbledWarplets: zero token URI setter");
        nftReserve = _nftReserve;
        warplets = INFTReserve(_nftReserve).nft();
        tokenURISetter = initialTokenURISetter;
        emit TokenURISetterChanged(initialTokenURISetter);
    }

    function setTokenURISetter(address newTokenURISetter) external onlyOwner {
        require(newTokenURISetter != address(0), "GobbledWarplets: zero token URI setter");
        tokenURISetter = newTokenURISetter;
        emit TokenURISetterChanged(newTokenURISetter);
    }

    function setAuction(address newAuction) external onlyReserve {
        auction = newAuction;
        emit AuctionUpdated(newAuction);
    }

    /// @inheritdoc IGobbledWarplets
    function createReceipt(address to, uint256 warpletId) external override onlyAuction returns (uint256 tokenId) {
        return _createReceipt(to, warpletId);
    }

    function _createReceipt(address to, uint256 warpletId) internal returns (uint256 tokenId) {
        require(warpletId < WARPLET_ID_PADDING, "GobbledWarplets: warpletId too large");
        uint256 gobbleIndex = _gobbles[warpletId];
        tokenId = _encodeTokenId(warpletId, gobbleIndex);
        require(_ownerOf(tokenId) == address(0), "GobbledWarplets: already minted");
        require(_reservedRecipient[tokenId] == address(0), "GobbledWarplets: already reserved");

        _gobbles[warpletId] = gobbleIndex + 1;
        _reservedRecipient[tokenId] = to;
        emit Reserved(to, warpletId, tokenId, gobbleIndex);
    }

    /// @notice Reserved recipient pulls the underlying Warplet from the auction without minting a receipt.
    /// @dev Leaves the reservation in place so the recipient can still call the metadata overload later
    ///      to mint the gobbled receipt (which will skip the second NFT transfer).
    function rescueWarplet(uint256 tokenId) external {
        address to = _reservedRecipient[tokenId];
        require(to != address(0), "GobbledWarplets: not reserved");
        require(msg.sender == to, "GobbledWarplets: not recipient");
        require(!warpletRescued[tokenId], "GobbledWarplets: already rescued");

        warpletRescued[tokenId] = true;

        (uint256 wid, uint256 idx) = _decodeTokenId(tokenId);
        warplets.transferFrom(nftReserve, to, wid);
        emit WarpletRescued(to, wid, tokenId, idx);
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
            warplets.transferFrom(nftReserve, to, wid);
        }
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
