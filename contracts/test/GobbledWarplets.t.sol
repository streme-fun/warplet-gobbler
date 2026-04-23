// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {MockAuctionNFT} from "./mocks/MockAuctionNFT.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Stand-in for `AuctionSell` in unit tests. Holds the underlying Warplet ERC721 the way the
///         live auction would, exposes the `nft()` getter `GobbledWarplets` reads via its minter
///         interface, and pre-approves a target operator (the `GobbledWarplets` contract) for all token
///         transfers — mirroring the `setApprovalForAll` that `AuctionSell` performs in its constructor.
contract MockGobbledMinter is IERC721Receiver {
    IERC721 public nft;

    constructor(IERC721 _nft) {
        nft = _nft;
    }

    function approveOperator(address operator) external {
        nft.setApprovalForAll(operator, true);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract GobbledWarpletsTest is Test {
    using MessageHashUtils for bytes32;

    string internal constant NAME = "Gobbled Warplets Test";
    string internal constant SYMBOL = "GWTEST";

    bytes32 internal constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant _MINT_TYPEHASH =
        keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");

    GobbledWarplets internal g;
    MockAuctionNFT internal warplets;
    MockGobbledMinter internal minterContract;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    uint256 internal constant SETTER_PK = 0xC0FFEE;
    address internal setter;

    string internal constant IPFS_URI = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    function setUp() public {
        setter = vm.addr(SETTER_PK);

        warplets = new MockAuctionNFT();
        minterContract = new MockGobbledMinter(IERC721(address(warplets)));

        vm.prank(owner);
        g = new GobbledWarplets(NAME, SYMBOL, address(minterContract), setter);

        // Mirror `AuctionSell` constructor: minter pre-approves the gobbled contract as operator.
        minterContract.approveOperator(address(g));
    }

    /// @dev Mint a Warplet to the mock minter so it owns the underlying NFT, then return the id.
    function _seedHeldWarplet() internal returns (uint256 wid) {
        wid = warplets.mint(address(minterContract));
    }

    /// @dev Mint a specific Warplet id to the mock minter (for boundary tests).
    function _seedHeldWarpletSpecific(uint256 wid) internal {
        warplets.mintSpecific(address(minterContract), wid);
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                _DOMAIN_TYPEHASH,
                keccak256(bytes(NAME)),
                keccak256(bytes("1")),
                block.chainid,
                address(g)
            )
        );
    }

    function _mintDigest(uint256 tokenId, string memory uri, uint256 deadline) internal view returns (bytes32) {
        bytes32 structHash =
            keccak256(abi.encode(_MINT_TYPEHASH, tokenId, keccak256(bytes(uri)), deadline));
        return _domainSeparator().toTypedDataHash(structHash);
    }

    function _signMint(uint256 tokenId, string memory uri, uint256 deadline)
        internal
        view
        returns (bytes memory signature)
    {
        bytes32 digest = _mintDigest(tokenId, uri, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SETTER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _rescueWithSig(address recipient, uint256 tokenId, string memory uri) internal {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signMint(tokenId, uri, deadline);
        vm.prank(recipient);
        g.rescueWarplet(tokenId, uri, deadline, sig);
    }

    function _expectedTokenId(uint256 warpletId) internal view returns (uint256) {
        uint256 idx = g.gobbleCount(warpletId);
        return idx * g.WARPLET_ID_PADDING() + warpletId;
    }

    /* ========== constructor / admin ========== */

    function test_constructor_sets_minter_and_setter() public view {
        assertEq(g.minter(), address(minterContract));
        assertEq(g.tokenURISetter(), setter);
        assertEq(g.owner(), owner);
    }

    function test_constructor_reverts_zero_minter() public {
        vm.expectRevert("GobbledWarplets: zero minter");
        vm.prank(owner);
        new GobbledWarplets(NAME, SYMBOL, address(0), setter);
    }

    function test_constructor_reverts_zero_tokenURISetter() public {
        vm.expectRevert("GobbledWarplets: zero token URI setter");
        vm.prank(owner);
        new GobbledWarplets(NAME, SYMBOL, address(minterContract), address(0));
    }

    function test_setMinter_onlyOwner() public {
        // The new minter must be a contract exposing `nft()`, otherwise rescue paths break — but
        // `setMinter` itself only checks non-zero + no pending rescues. Use a fresh mock minter so the assertion sticks.
        MockGobbledMinter newM = new MockGobbledMinter(IERC721(address(warplets)));
        vm.prank(alice);
        vm.expectRevert();
        g.setMinter(address(newM));

        vm.prank(owner);
        g.setMinter(address(newM));
        assertEq(g.minter(), address(newM));
    }

    function test_setMinter_reverts_while_pending_rescue_exists() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        g.reserve(alice, wid);

        MockGobbledMinter newM = new MockGobbledMinter(IERC721(address(warplets)));
        vm.prank(owner);
        vm.expectRevert("GobbledWarplets: pending rescues");
        g.setMinter(address(newM));

        assertEq(g.minter(), address(minterContract));
        assertEq(g.pendingUnderlyingRescues(), 1);
    }

    /// @dev `tokenURISetter` is the EIP-712 signer for `rescueWarplet`, not an on-chain URI setter.
    function test_setTokenURISetter_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        g.setTokenURISetter(address(minterContract));

        vm.prank(owner);
        g.setTokenURISetter(address(minterContract));
        assertEq(g.tokenURISetter(), address(minterContract));
    }

    /* ========== reserve ========== */

    function test_reserve_onlyMinter() public {
        uint256 wid = _seedHeldWarplet();

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not minter");
        g.reserve(alice, wid);

        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);
        assertEq(tid, wid);
        assertEq(g.pendingUnderlyingRescues(), 1);

        vm.expectRevert();
        g.ownerOf(tid);

        _rescueWithSig(alice, tid, IPFS_URI);
        assertEq(g.ownerOf(tid), alice);
        assertEq(warplets.ownerOf(wid), alice);
        assertEq(g.totalSupply(), 1);
        assertEq(g.pendingUnderlyingRescues(), 0);
    }

    function test_reserve_reverts_warplet_id_too_large() public {
        uint256 wid = g.WARPLET_ID_PADDING();
        vm.prank(address(minterContract));
        vm.expectRevert("GobbledWarplets: warpletId too large");
        g.reserve(alice, wid);
    }

    function test_second_gobble_increments_index_and_tokenId() public {
        // Warplet id 100 must be unused on the mock NFT — `mint()` starts at 1, so 100 is free.
        _seedHeldWarpletSpecific(100);

        vm.startPrank(address(minterContract));
        uint256 t0 = g.reserve(alice, 100);
        address bob = makeAddr("bob");
        uint256 t1 = g.reserve(bob, 100);
        vm.stopPrank();
        assertEq(t0, 100);
        assertEq(t1, 100_000_100);
        assertEq(g.gobbleCount(100), 2);

        // Only the first reservation can claim the underlying NFT (only one was minted under id 100).
        _rescueWithSig(alice, t0, IPFS_URI);
        assertEq(warplets.ownerOf(100), alice);

        // Second receipt: alice transfers warplet 100 back so bob's rescue has something to pull.
        vm.prank(alice);
        warplets.safeTransferFrom(alice, address(minterContract), 100);
        _rescueWithSig(bob, t1, IPFS_URI);
        assertEq(warplets.ownerOf(100), bob);
        assertEq(g.totalSupply(), 2);
    }

    function test_tokenURI_reverts_before_rescue() public {
        uint256 warpletId = _seedHeldWarplet();
        uint256 tokenId = _expectedTokenId(warpletId);

        vm.prank(address(minterContract));
        g.reserve(alice, warpletId);

        vm.expectRevert();
        g.tokenURI(tokenId);

        _rescueWithSig(alice, tokenId, IPFS_URI);
        assertEq(g.tokenURI(tokenId), IPFS_URI);
    }

    /* ========== rescueWarplet — variant 2 (signed metadata + transfer) ========== */

    function test_rescue_with_sig_from_recipient_after_reserve() public {
        uint256 warpletId = _seedHeldWarplet();
        uint256 tokenId = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(address(minterContract));
        g.reserve(alice, warpletId);

        bytes memory sig = _signMint(tokenId, IPFS_URI, deadline);
        vm.prank(alice);
        g.rescueWarplet(tokenId, IPFS_URI, deadline, sig);

        assertEq(g.ownerOf(tokenId), alice);
        assertEq(g.tokenURI(tokenId), IPFS_URI);
        assertEq(warplets.ownerOf(warpletId), alice);
        assertTrue(g.warpletRescued(tokenId));
    }

    function test_rescue_with_sig_reverts_expired_deadline() public {
        uint256 warpletId = _seedHeldWarplet();
        uint256 tid = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1;

        vm.prank(address(minterContract));
        g.reserve(alice, warpletId);

        bytes memory sig = _signMint(tid, IPFS_URI, deadline);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: signature expired");
        g.rescueWarplet(tid, IPFS_URI, deadline, sig);
    }

    function test_rescue_with_sig_reverts_wrong_signer() public {
        uint256 warpletId = _seedHeldWarplet();
        uint256 tid = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(address(minterContract));
        g.reserve(alice, warpletId);

        uint256 wrongPk = 0xBEEF;
        bytes32 digest = _mintDigest(tid, IPFS_URI, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: invalid signer");
        g.rescueWarplet(tid, IPFS_URI, deadline, sig);
    }

    function test_rescue_with_sig_reverts_after_owner_changes_setter() public {
        uint256 warpletId = _seedHeldWarplet();
        uint256 tid = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(address(minterContract));
        g.reserve(alice, warpletId);

        bytes memory sig = _signMint(tid, IPFS_URI, deadline);

        address newSetter = makeAddr("newSetter");
        vm.prank(owner);
        g.setTokenURISetter(newSetter);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: invalid signer");
        g.rescueWarplet(tid, IPFS_URI, deadline, sig);
    }

    function test_rescue_with_sig_reverts_without_prior_reserve() public {
        uint256 tokenId = 1;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signMint(tokenId, IPFS_URI, deadline);
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not reserved");
        g.rescueWarplet(tokenId, IPFS_URI, deadline, sig);
    }

    function test_rescue_with_sig_cannot_run_twice_after_completion() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);
        _rescueWithSig(alice, tid, IPFS_URI);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig2 = _signMint(tid, IPFS_URI, deadline);
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not reserved");
        g.rescueWarplet(tid, IPFS_URI, deadline, sig2);
    }

    function test_rescue_with_sig_reverts_stranger_not_recipient() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signMint(tid, IPFS_URI, deadline);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert("GobbledWarplets: not recipient");
        g.rescueWarplet(tid, IPFS_URI, deadline, sig);
    }

    /* ========== rescueWarplet — variant 1 (bare, no metadata) ========== */

    function test_bare_rescue_pulls_warplet_without_minting_receipt() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        assertFalse(g.warpletRescued(tid));

        vm.prank(alice);
        g.rescueWarplet(tid);

        assertEq(warplets.ownerOf(wid), alice);
        assertTrue(g.warpletRescued(tid));
        assertEq(g.pendingUnderlyingRescues(), 0);
        // Receipt was NOT minted.
        vm.expectRevert();
        g.ownerOf(tid);
        assertEq(g.totalSupply(), 0);
    }

    function test_bare_rescue_reverts_stranger() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert("GobbledWarplets: not recipient");
        g.rescueWarplet(tid);
    }

    function test_bare_rescue_reverts_when_unreserved() public {
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not reserved");
        g.rescueWarplet(1);
    }

    function test_bare_rescue_reverts_on_replay() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        vm.prank(alice);
        g.rescueWarplet(tid);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: already rescued");
        g.rescueWarplet(tid);
    }

    function test_setMinter_succeeds_after_bare_rescue_clears_pending_dependency() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        vm.prank(alice);
        g.rescueWarplet(tid);

        MockGobbledMinter newMinter = new MockGobbledMinter(IERC721(address(warplets)));
        vm.prank(owner);
        g.setMinter(address(newMinter));

        assertEq(g.minter(), address(newMinter));
        assertEq(g.pendingUnderlyingRescues(), 0);
    }

    /* ========== variant 1 → variant 2 sequence ========== */

    function test_signed_rescue_after_bare_rescue_mints_receipt_skips_transfer() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        // Bare rescue first: warplet is alice's, receipt unminted.
        vm.prank(alice);
        g.rescueWarplet(tid);
        assertEq(warplets.ownerOf(wid), alice);
        assertTrue(g.warpletRescued(tid));

        // Then mint the receipt with metadata. Should NOT touch the underlying NFT (no allowance issue
        // even though the auction no longer holds it).
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signMint(tid, IPFS_URI, deadline);
        vm.prank(alice);
        g.rescueWarplet(tid, IPFS_URI, deadline, sig);

        assertEq(g.ownerOf(tid), alice);
        assertEq(g.tokenURI(tid), IPFS_URI);
        assertEq(warplets.ownerOf(wid), alice);
        assertEq(g.pendingUnderlyingRescues(), 0);
    }

    function test_bare_rescue_after_signed_rescue_reverts() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        _rescueWithSig(alice, tid, IPFS_URI);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not reserved");
        g.rescueWarplet(tid);
    }

    function test_setMinter_succeeds_after_signed_rescue_clears_pending_dependency() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);

        _rescueWithSig(alice, tid, IPFS_URI);

        MockGobbledMinter newMinter = new MockGobbledMinter(IERC721(address(warplets)));
        vm.prank(owner);
        g.setMinter(address(newMinter));

        assertEq(g.minter(), address(newMinter));
        assertEq(g.pendingUnderlyingRescues(), 0);
    }

    /* ========== misc ========== */

    function test_warpletOf_and_gobbleIndexOf() public {
        uint256 wid = _seedHeldWarplet();
        vm.prank(address(minterContract));
        uint256 tid = g.reserve(alice, wid);
        _rescueWithSig(alice, tid, IPFS_URI);
        assertEq(g.warpletOf(tid), wid);
        assertEq(g.gobbleIndexOf(tid), 0);

        // Second gobble of same warplet — alice transfers it back to the minter to "re-deposit".
        vm.prank(alice);
        warplets.safeTransferFrom(alice, address(minterContract), wid);
        vm.prank(address(minterContract));
        uint256 tid2 = g.reserve(alice, wid);
        _rescueWithSig(alice, tid2, IPFS_URI);
        assertEq(g.warpletOf(tid2), wid);
        assertEq(g.gobbleIndexOf(tid2), 1);
    }

    function test_supportsInterface_721_enumerable_metadata() public view {
        assertTrue(g.supportsInterface(type(IERC721Enumerable).interfaceId));
        assertTrue(g.supportsInterface(type(IERC721Metadata).interfaceId));
    }
}
