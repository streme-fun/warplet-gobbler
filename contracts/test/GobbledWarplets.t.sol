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
    bytes32 internal constant _SET_TOKEN_URI_TYPEHASH =
        keccak256("SetTokenURI(uint256 tokenId,string uri,uint256 deadline)");

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

    function _setTokenUriDigest(uint256 tokenId, string memory uri, uint256 deadline) internal view returns (bytes32) {
        bytes32 structHash =
            keccak256(abi.encode(_SET_TOKEN_URI_TYPEHASH, tokenId, keccak256(bytes(uri)), deadline));
        return _domainSeparator().toTypedDataHash(structHash);
    }

    function _signSetTokenURI(uint256 tokenId, string memory uri, uint256 deadline)
        internal
        view
        returns (bytes memory signature)
    {
        bytes32 digest = _setTokenUriDigest(tokenId, uri, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SETTER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _expectedTokenId(uint256 warpletId) internal view returns (uint256) {
        uint256 idx = g.gobbleCount(warpletId);
        return idx * g.TOKEN_ID_DECIMAL_STRIDE() + warpletId;
    }

    function _arr2(uint256 a, uint256 b) private pure returns (uint256[] memory o) {
        o = new uint256[](2);
        o[0] = a;
        o[1] = b;
    }

    function _strArr2(string memory a, string memory b) private pure returns (string[] memory o) {
        o = new string[](2);
        o[0] = a;
        o[1] = b;
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

    function test_setTokenURISetter_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        g.setTokenURISetter(minter);

        vm.prank(owner);
        g.setTokenURISetter(minter);
        assertEq(g.tokenURISetter(), minter);
    }

    function test_mint_onlyMinter() public {
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not minter");
        g.mint(alice, 7);

        vm.prank(minter);
        uint256 tid = g.mint(alice, 7);
        assertEq(tid, 7);
        assertEq(g.ownerOf(tid), alice);
        assertEq(g.totalSupply(), 1);
    }

    function test_mint_reverts_warplet_id_too_large() public {
        uint256 wid = g.MAX_WARPLET_ID_EXCLUSIVE();
        vm.prank(minter);
        vm.expectRevert("GobbledWarplets: warpletId too large");
        g.mint(alice, wid);
    }

    function test_mint_second_gobble_increments_index_and_tokenId() public {
        vm.startPrank(minter);
        uint256 t0 = g.mint(alice, 100);
        uint256 t1 = g.mint(makeAddr("bob"), 100);
        vm.stopPrank();
        assertEq(t0, 100);
        assertEq(t1, 1_000_100);
        assertEq(g.gobbleCount(100), 2);
    }

    function test_tokenURI_reverts_when_not_minted_even_if_storage_written() public {
        uint256 warpletId = 5;
        uint256 tokenId = _expectedTokenId(warpletId);
        assertEq(tokenId, warpletId);

        vm.prank(setter);
        g.setTokenURI(tokenId, IPFS_URI);

        vm.expectRevert();
        g.tokenURI(tokenId);

        vm.prank(minter);
        g.mint(alice, warpletId);

        assertEq(g.tokenURI(tokenId), IPFS_URI);
    }

    function test_setTokenURI_stranger_reverts() public {
        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not token URI setter");
        g.setTokenURI(1, IPFS_URI);
    }

    function test_setTokenURI_setter_can_override_after_mint() public {
        uint256 wid = 9;
        vm.prank(minter);
        uint256 tid = g.mint(alice, wid);

        vm.startPrank(setter);
        g.setTokenURI(tid, "ipfs://first");
        assertEq(g.tokenURI(tid), "ipfs://first");
        g.setTokenURI(tid, "ipfs://second");
        vm.stopPrank();
        assertEq(g.tokenURI(tid), "ipfs://second");
    }

    function test_batchSetTokenURI() public {
        uint256 w0 = 1;
        uint256 w1 = 2;
        uint256 t0 = _expectedTokenId(w0);
        uint256 t1 = _expectedTokenId(w1);

        vm.startPrank(setter);
        g.batchSetTokenURI(_arr2(t0, t1), _strArr2("ipfs://a", "ipfs://b"));
        vm.stopPrank();

        vm.prank(minter);
        g.mint(alice, w0);
        vm.prank(minter);
        g.mint(makeAddr("bob"), w1);

        assertEq(g.tokenURI(t0), "ipfs://a");
        assertEq(g.tokenURI(t1), "ipfs://b");
    }

    function test_batchSetTokenURI_stranger_reverts() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        string[] memory uris = new string[](1);
        uris[0] = "x";

        vm.prank(alice);
        vm.expectRevert("GobbledWarplets: not token URI setter");
        g.batchSetTokenURI(ids, uris);
    }

    function test_batchSetTokenURI_length_mismatch_reverts() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        string[] memory uris = new string[](2);
        uris[0] = "a";
        uris[1] = "b";

        vm.prank(setter);
        vm.expectRevert("GobbledWarplets: length mismatch");
        g.batchSetTokenURI(ids, uris);
    }

    function test_setTokenURIWithSig_relayer_sets_before_mint() public {
        uint256 warpletId = 11;
        uint256 tokenId = _expectedTokenId(warpletId);
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signSetTokenURI(tokenId, IPFS_URI, deadline);

        address relayer = makeAddr("relayer");
        vm.prank(relayer);
        g.setTokenURIWithSig(tokenId, IPFS_URI, deadline, sig);

        vm.expectRevert();
        g.tokenURI(tokenId);

        vm.prank(minter);
        g.mint(alice, warpletId);

        assertEq(g.tokenURI(tokenId), IPFS_URI);
    }

    function test_setTokenURIWithSig_reverts_after_uri_set() public {
        uint256 tid = 3;
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(setter);
        g.setTokenURI(tid, IPFS_URI);

        bytes memory sig = _signSetTokenURI(tid, "ipfs://other", deadline);
        vm.expectRevert("GobbledWarplets: uri already set");
        g.setTokenURIWithSig(tid, "ipfs://other", deadline, sig);
    }

    function test_setTokenURIWithSig_reverts_expired_deadline() public {
        uint256 tid = 8;
        uint256 deadline = block.timestamp + 1;
        bytes memory sig = _signSetTokenURI(tid, IPFS_URI, deadline);

        vm.warp(block.timestamp + 2);

        vm.expectRevert("GobbledWarplets: signature expired");
        g.setTokenURIWithSig(tid, IPFS_URI, deadline, sig);
    }

    function test_setTokenURIWithSig_reverts_wrong_signer() public {
        uint256 tid = 7;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 wrongPk = 0xBEEF;
        bytes32 digest = _setTokenUriDigest(tid, IPFS_URI, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert("GobbledWarplets: invalid signer");
        g.setTokenURIWithSig(tid, IPFS_URI, deadline, sig);
    }

    function test_setTokenURIWithSig_reverts_after_owner_changes_setter() public {
        uint256 tid = 17;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSetTokenURI(tid, IPFS_URI, deadline);

        address newSetter = makeAddr("newSetter");
        vm.prank(owner);
        g.setTokenURISetter(newSetter);

        vm.expectRevert("GobbledWarplets: invalid signer");
        g.setTokenURIWithSig(tid, IPFS_URI, deadline, sig);
    }

    function test_warpletOf_and_gobbleIndexOf() public {
        uint256 wid = 4242;
        vm.prank(minter);
        uint256 tid = g.mint(alice, wid);
        assertEq(g.warpletOf(tid), wid);
        assertEq(g.gobbleIndexOf(tid), 0);

        vm.prank(minter);
        uint256 tid2 = g.mint(alice, wid);
        assertEq(g.warpletOf(tid2), wid);
        assertEq(g.gobbleIndexOf(tid2), 1);
    }

    function test_supportsInterface_721_enumerable_metadata() public view {
        assertTrue(g.supportsInterface(type(IERC721Enumerable).interfaceId));
        assertTrue(g.supportsInterface(type(IERC721Metadata).interfaceId));
    }
}
