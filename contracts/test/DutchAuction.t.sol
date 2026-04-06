// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {DutchAuction} from "../src/DutchAuction.sol";
import {IDutchAuction} from "../src/interfaces/IDutchAuction.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockUSDCx is ERC20 {
    constructor() ERC20("Mock USDCx", "USDCx") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockWarplets is ERC721 {
    constructor() ERC721("Mock Warplets", "WARPLET") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

contract OtherMock721 is ERC721 {
    constructor() ERC721("Other", "OTH") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

contract DutchAuctionTest is Test {
    MockWarplets internal warplets;
    MockUSDCx internal paymentToken;
    DutchAuction internal auction;

    address internal seller = makeAddr("seller");
    address internal nftReserve = makeAddr("nftReserve");
    address internal recoveryWallet = makeAddr("recoveryWallet");

    uint256 internal constant TOKEN_ID = 1;
    uint256 internal constant POT = 1_000e18;

    function setUp() public {
        warplets = new MockWarplets();
        paymentToken = new MockUSDCx();
        auction = new DutchAuction(address(warplets), address(paymentToken), nftReserve, recoveryWallet);

        warplets.mint(seller, TOKEN_ID);
        paymentToken.mint(address(auction), POT);
    }

    function test_constructor_sets_approval_for_recovery_wallet() public view {
        uint256 allowance = paymentToken.allowance(address(auction), recoveryWallet);
        assertEq(allowance, type(uint256).max);
    }

    function test_currentPrice_returns_payment_token_balance() public view {
        assertEq(auction.currentPrice(), POT);
    }

    function test_gobble_reverts_when_min_price_is_higher_than_pot() public {
        vm.prank(seller);
        warplets.approve(address(auction), TOKEN_ID);

        vm.expectRevert(bytes("Price is too low, try again later"));
        vm.prank(seller);
        auction.gobble(TOKEN_ID, POT + 1);

        assertEq(warplets.ownerOf(TOKEN_ID), seller);
    }

    function test_gobble_transfers_nft_and_pays_full_pot_and_emits_event() public {
        vm.prank(seller);
        warplets.approve(address(auction), TOKEN_ID);

        vm.expectEmit(true, true, false, true, address(auction));
        emit IDutchAuction.Gobbled(seller, TOKEN_ID, POT);

        vm.prank(seller);
        auction.gobble(TOKEN_ID, POT);

        assertEq(warplets.ownerOf(TOKEN_ID), nftReserve);
        assertEq(paymentToken.balanceOf(address(auction)), 0);
        assertEq(paymentToken.balanceOf(seller), POT);
    }

    function test_safeTransferFrom_to_auction_with_encoded_min_price_gobbles_same_as_gobble() public {
        vm.prank(seller);
        warplets.setApprovalForAll(address(auction), true);

        vm.expectEmit(true, true, false, true, address(auction));
        emit IDutchAuction.Gobbled(seller, TOKEN_ID, POT);

        vm.prank(seller);
        warplets.safeTransferFrom(seller, address(auction), TOKEN_ID, abi.encode(POT));

        assertEq(warplets.ownerOf(TOKEN_ID), nftReserve);
        assertEq(paymentToken.balanceOf(seller), POT);
    }

    function test_gobble_reverts_when_wrong_collection_safe_transferred() public {
        OtherMock721 other = new OtherMock721();
        uint256 otherId = 7;
        other.mint(seller, otherId);
        vm.prank(seller);
        other.setApprovalForAll(address(auction), true);

        vm.prank(seller);
        vm.expectRevert(bytes("DutchAuction: only Warplets"));
        other.safeTransferFrom(seller, address(auction), otherId, abi.encode(POT));

        assertEq(other.ownerOf(otherId), seller);
        assertEq(paymentToken.balanceOf(seller), 0);
    }

    function test_gobble_reverts_when_hook_data_not_encoded_min_price() public {
        vm.prank(seller);
        warplets.setApprovalForAll(address(auction), true);

        vm.prank(seller);
        vm.expectRevert();
        warplets.safeTransferFrom(seller, address(auction), TOKEN_ID, "");

        assertEq(warplets.ownerOf(TOKEN_ID), seller);
    }
}
