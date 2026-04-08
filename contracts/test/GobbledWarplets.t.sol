// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract GobbledWarpletsTest is Test {
    using MessageHashUtils for bytes32;

    string internal constant NAME = "Gobbled Warplets Test";
    string internal constant SYMBOL = "GWTEST";

    bytes32 internal constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant _MINT_TYPEHASH =
        keccak256("Mint(uint256 tokenId,string uri,uint256 deadline)");

    GobbledWarplets internal g;

    address internal owner = makeAddr("owner");
    address internal minter = makeAddr("minter");
    address internal alice = makeAddr("alice");

    uint256 internal constant SETTER_PK = 0xC0FFEE;
    address internal setter;

    string internal constant IPFS_URI = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    function setUp() public {
        setter = vm.addr(SETTER_PK);
        vm.prank(owner);
        g = new GobbledWarplets(NAME, SYMBOL, minter, setter);
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

    function _mintWithSig(address recipient, uint256 tokenId, string memory uri) internal {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signMint(tokenId, uri, deadline);
        vm.prank(recipient);
        g.mint(tokenId, uri, deadline, sig);
    }

    function _expectedTokenId(uint256 warpletId) internal view returns (uint256) {
        uint256 idx = g.gobbleCount(warpletId);
        return idx * g.TOKEN_ID_DECIMAL_STRIDE() + warpletId;
    }

    function test_constructor_sets_minter_and_setter() public view {
        assertEq(g.minter(), minter);
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
        new GobbledWarplets(NAME, SYMBOL, minter, address(0));
    }

    function test_setMinter_onlyOwner() public {
        address newM = makeAddr("newMinter");
        vm.prank(alice);
        vm.expectRevert();
        g.setMinter(newM);

        vm.prank(owner);
        g.setMinter(newM);
        assertEq(g.minter(), newM);
    }

    /// @dev `tokenURISetter` is the EIP-712 signer for `mint`, not an on-chain URI setter.
    function test_setTokenURISetter_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        g.setTokenURISetter(minter);

        vm.prank(owner);
        g.setTokenURISetter(minter);
        assertEq(g.tokenURISetter(), minter);
    }

    function test_reserve_onlyMinter() public {
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not minter");
        g.reserve(alice, 7);

        vm.prank(minter);
        uint256 tid = g.reserve(alice, 7);
        assertEq(tid, 7);

        vm.expectRevert();
        g.ownerOf(tid);

        _mintWithSig(alice, tid, IPFS_URI);
        assertEq(g.ownerOf(tid), alice);
        assertEq(g.totalSupply(), 1);
    }

    function test_reserve_reverts_warplet_id_too_large() public {
        uint256 wid = g.MAX_WARPLET_ID_EXCLUSIVE();
        vm.prank(minter);
        vm.expectRevert("GobbledWarplets: warpletId too large");
        g.reserve(alice, wid);
    }

    function test_second_gobble_increments_index_and_tokenId() public {
        vm.startPrank(minter);
        uint256 t0 = g.reserve(alice, 100);
        address bob = makeAddr("bob");
        uint256 t1 = g.reserve(bob, 100);
        vm.stopPrank();
        assertEq(t0, 100);
        assertEq(t1, 1_000_100);
        assertEq(g.gobbleCount(100), 2);

        _mintWithSig(alice, t0, IPFS_URI);
        _mintWithSig(bob, t1, IPFS_URI);
        assertEq(g.totalSupply(), 2);
    }

    function test_tokenURI_reverts_before_mint() public {
        uint256 warpletId = 5;
        uint256 tokenId = _expectedTokenId(warpletId);

        vm.prank(minter);
        g.reserve(alice, warpletId);

        vm.expectRevert();
        g.tokenURI(tokenId);

        _mintWithSig(alice, tokenId, IPFS_URI);
        assertEq(g.tokenURI(tokenId), IPFS_URI);
    }

    function test_mint_with_sig_from_recipient_after_reserve() public {
        uint256 warpletId = 11;
        uint256 tokenId = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(minter);
        g.reserve(alice, warpletId);

        bytes memory sig = _signMint(tokenId, IPFS_URI, deadline);
        vm.prank(alice);
        g.mint(tokenId, IPFS_URI, deadline, sig);

        assertEq(g.ownerOf(tokenId), alice);
        assertEq(g.tokenURI(tokenId), IPFS_URI);
    }

    function test_mint_reverts_expired_deadline() public {
        uint256 warpletId = 8;
        uint256 tid = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1;

        vm.prank(minter);
        g.reserve(alice, warpletId);

        bytes memory sig = _signMint(tid, IPFS_URI, deadline);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: signature expired");
        g.mint(tid, IPFS_URI, deadline, sig);
    }

    function test_mint_reverts_wrong_signer() public {
        uint256 warpletId = 7;
        uint256 tid = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(minter);
        g.reserve(alice, warpletId);

        uint256 wrongPk = 0xBEEF;
        bytes32 digest = _mintDigest(tid, IPFS_URI, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: invalid signer");
        g.mint(tid, IPFS_URI, deadline, sig);
    }

    function test_mint_reverts_after_owner_changes_setter() public {
        uint256 warpletId = 17;
        uint256 tid = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(minter);
        g.reserve(alice, warpletId);

        bytes memory sig = _signMint(tid, IPFS_URI, deadline);

        address newSetter = makeAddr("newSetter");
        vm.prank(owner);
        g.setTokenURISetter(newSetter);

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: invalid signer");
        g.mint(tid, IPFS_URI, deadline, sig);
    }

    function test_mint_reverts_without_prior_reserve() public {
        uint256 tokenId = 1;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signMint(tokenId, IPFS_URI, deadline);
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not reserved");
        g.mint(tokenId, IPFS_URI, deadline, sig);
    }

    function test_mint_cannot_run_twice_after_completion() public {
        vm.prank(minter);
        uint256 tid = g.reserve(alice, 7);
        _mintWithSig(alice, tid, IPFS_URI);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig2 = _signMint(tid, IPFS_URI, deadline);
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not reserved");
        g.mint(tid, IPFS_URI, deadline, sig2);
    }

    function test_mint_reverts_stranger_not_recipient() public {
        uint256 wid = 4242;
        vm.prank(minter);
        uint256 tid = g.reserve(alice, wid);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signMint(tid, IPFS_URI, deadline);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert("GobbledWarplets: not recipient");
        g.mint(tid, IPFS_URI, deadline, sig);
    }

    function test_warpletOf_and_gobbleIndexOf() public {
        uint256 wid = 4242;
        vm.prank(minter);
        uint256 tid = g.reserve(alice, wid);
        _mintWithSig(alice, tid, IPFS_URI);
        assertEq(g.warpletOf(tid), wid);
        assertEq(g.gobbleIndexOf(tid), 0);

        vm.prank(minter);
        uint256 tid2 = g.reserve(alice, wid);
        _mintWithSig(alice, tid2, IPFS_URI);
        assertEq(g.warpletOf(tid2), wid);
        assertEq(g.gobbleIndexOf(tid2), 1);
    }

    function test_supportsInterface_721_enumerable_metadata() public view {
        assertTrue(g.supportsInterface(type(IERC721Enumerable).interfaceId));
        assertTrue(g.supportsInterface(type(IERC721Metadata).interfaceId));
    }
}
