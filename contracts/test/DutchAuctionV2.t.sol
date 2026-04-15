// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {DutchAuctionV2} from "../src/DutchAuctionV2.sol";
import {IDutchAuction} from "../src/interfaces/IDutchAuction.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

// ─── Mock ERC-777 token ───────────────────────────────────────────────
// Real WARPGOBB is a Superfluid SuperToken (ERC-777). We mock the send()
// function so the callback fires without needing the full ERC-1820 registry.

interface IERC777Recipient {
    function tokensReceived(
        address operator, address from, address to,
        uint256 amount, bytes calldata userData, bytes calldata operatorData
    ) external;
}

contract MockWarpgobb is ERC20 {
    constructor() ERC20("Mock WARPGOBB", "WARPGOBB") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    /// @dev Mimics ERC-777 send: transfer + tokensReceived callback.
    function send(address recipient, uint256 amount, bytes calldata data) external {
        _transfer(msg.sender, recipient, amount);
        // ERC-777 calls tokensReceived on the recipient if it's a contract
        if (recipient.code.length > 0) {
            IERC777Recipient(recipient).tokensReceived(
                msg.sender, msg.sender, recipient, amount, data, ""
            );
        }
    }
}

// ─── Mock Warplets ────────────────────────────────────────────────────

contract MockWarplets is ERC721 {
    constructor() ERC721("Mock Warplets", "WARPLET") {}
    function mint(address to, uint256 tokenId) external { _mint(to, tokenId); }
}

contract OtherNFT is ERC721 {
    constructor() ERC721("Other", "OTH") {}
    function mint(address to, uint256 tokenId) external { _mint(to, tokenId); }
}

// ─── Mock nftReserve ──────────────────────────────────────────────────

contract MockNftReserve is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}

// ─── Hook implementations ─────────────────────────────────────────────

/// @dev Well-behaved arb hook: receives WARPGOBB via tokensReceived,
///      decodes tokenId from userData, delivers the NFT to nftReserve.
contract GoodFlashHook is IERC777Recipient, IERC721Receiver {
    IERC721 public warplets;

    constructor(address _warplets) { warplets = IERC721(_warplets); }

    function tokensReceived(
        address, address from, address, uint256, bytes calldata userData, bytes calldata
    ) external override {
        uint256 tokenId = abi.decode(userData, (uint256));
        // Read nftReserve from the auction
        address nftReserve = DutchAuctionV2(from).nftReserve();
        warplets.safeTransferFrom(address(this), nftReserve, tokenId);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @dev Hook that does nothing in tokensReceived — doesn't deliver the NFT.
contract DoNothingHook is IERC777Recipient {
    function tokensReceived(
        address, address, address, uint256, bytes calldata, bytes calldata
    ) external override {}
}

/// @dev Hook that tries to re-enter gobbleFlash with a different tokenId.
contract ReentrantFlashHook is IERC777Recipient {
    DutchAuctionV2 public auction;
    uint256 public reenterTokenId;
    bool public reentered;

    constructor(address _auction) { auction = DutchAuctionV2(_auction); }
    function setReenterTokenId(uint256 id) external { reenterTokenId = id; }

    function tokensReceived(
        address, address, address, uint256, bytes calldata, bytes calldata
    ) external override {
        if (!reentered) {
            reentered = true;
            auction.gobbleFlash(reenterTokenId);
        }
    }
}

/// @dev Hook that re-enters via the original gobble(tokenId, minPrice) path.
contract ReentrantOriginalGobbleHook is IERC777Recipient, IERC721Receiver {
    DutchAuctionV2 public auction;
    IERC721 public warplets;
    uint256 public reenterTokenId;

    constructor(address _auction, address _warplets) {
        auction = DutchAuctionV2(_auction);
        warplets = IERC721(_warplets);
    }
    function setReenterTokenId(uint256 id) external { reenterTokenId = id; }

    function tokensReceived(
        address, address, address, uint256, bytes calldata, bytes calldata
    ) external override {
        warplets.approve(address(auction), reenterTokenId);
        auction.gobble(reenterTokenId, 0);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @dev Hook that checks the params received in tokensReceived are correct.
contract ParamCheckHook is IERC777Recipient, IERC721Receiver {
    IERC721 public warplets;

    address public lastFrom;
    uint256 public lastAmount;
    uint256 public lastTokenId;

    constructor(address _warplets) { warplets = IERC721(_warplets); }

    function tokensReceived(
        address, address from, address, uint256 amount, bytes calldata userData, bytes calldata
    ) external override {
        lastFrom = from;
        lastAmount = amount;
        lastTokenId = abi.decode(userData, (uint256));
        address nftReserve = DutchAuctionV2(from).nftReserve();
        warplets.safeTransferFrom(address(this), nftReserve, lastTokenId);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}

// ─── Tests ────────────────────────────────────────────────────────────

contract DutchAuctionV2Test is Test {
    MockWarplets internal warplets;
    MockWarpgobb internal paymentToken;
    MockNftReserve internal reserve;
    DutchAuctionV2 internal auction;

    address internal seller = makeAddr("seller");
    address internal feeHandler = makeAddr("feeHandler");

    uint256 internal constant TOKEN_ID = 42;
    uint256 internal constant POT = 1_000e18;

    function setUp() public {
        warplets = new MockWarplets();
        paymentToken = new MockWarpgobb();
        reserve = new MockNftReserve();
        auction = new DutchAuctionV2(
            address(warplets), address(paymentToken), address(reserve), feeHandler
        );
        paymentToken.mint(address(auction), POT);
        warplets.mint(seller, TOKEN_ID);
    }

    // ═════════════════════════════════════════════════════════════════
    //  V1 path: gobble(tokenId, minPrice) — unchanged from V1
    // ═════════════════════════════════════════════════════════════════

    function test_v1_gobble_transfers_nft_and_pays() public {
        vm.startPrank(seller);
        warplets.approve(address(auction), TOKEN_ID);
        auction.gobble(TOKEN_ID, POT);
        vm.stopPrank();

        assertEq(warplets.ownerOf(TOKEN_ID), address(reserve));
        assertEq(paymentToken.balanceOf(seller), POT);
        assertEq(auction.currentPrice(), 0);
    }

    function test_v1_gobble_reverts_below_minPrice() public {
        vm.startPrank(seller);
        warplets.approve(address(auction), TOKEN_ID);
        vm.expectRevert("Price is too low, try again later");
        auction.gobble(TOKEN_ID, POT + 1);
        vm.stopPrank();
    }

    function test_v1_gobble_emits_event() public {
        vm.startPrank(seller);
        warplets.approve(address(auction), TOKEN_ID);
        vm.expectEmit(true, true, false, true, address(auction));
        emit IDutchAuction.Gobbled(seller, TOKEN_ID, POT);
        auction.gobble(TOKEN_ID, POT);
        vm.stopPrank();
    }

    function test_v1_rejects_wrong_nft_collection() public {
        OtherNFT other = new OtherNFT();
        other.mint(seller, 1);
        vm.prank(seller);
        vm.expectRevert("DutchAuction: only Warplets");
        other.safeTransferFrom(seller, address(auction), 1, abi.encode(uint256(0)));
    }

    // ═════════════════════════════════════════════════════════════════
    //  Flash path: gobbleFlash(tokenId) — new in V2
    // ═════════════════════════════════════════════════════════════════

    function test_flash_happy_path() public {
        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        // Give the NFT to the hook (simulating it already acquired the Warplet)
        vm.prank(seller);
        warplets.transferFrom(seller, address(hook), TOKEN_ID);

        vm.prank(address(hook));
        auction.gobbleFlash(TOKEN_ID);

        assertEq(warplets.ownerOf(TOKEN_ID), address(reserve));
        assertEq(paymentToken.balanceOf(address(hook)), POT);
        assertEq(auction.currentPrice(), 0);
    }

    function test_flash_emits_gobbled_event() public {
        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        vm.prank(seller);
        warplets.transferFrom(seller, address(hook), TOKEN_ID);

        vm.expectEmit(true, true, false, true, address(auction));
        emit IDutchAuction.Gobbled(address(hook), TOKEN_ID, POT);

        vm.prank(address(hook));
        auction.gobbleFlash(TOKEN_ID);
    }

    function test_flash_callback_receives_correct_params() public {
        ParamCheckHook hook = new ParamCheckHook(address(warplets));
        vm.prank(seller);
        warplets.transferFrom(seller, address(hook), TOKEN_ID);

        vm.prank(address(hook));
        auction.gobbleFlash(TOKEN_ID);

        assertEq(hook.lastFrom(), address(auction));
        assertEq(hook.lastAmount(), POT);
        assertEq(hook.lastTokenId(), TOKEN_ID);
    }

    function test_flash_reverts_if_nft_not_delivered() public {
        DoNothingHook hook = new DoNothingHook();
        vm.prank(address(hook));
        vm.expectRevert("NFT not in reserve yet");
        auction.gobbleFlash(TOKEN_ID);
    }

    function test_flash_reverts_if_nft_already_in_reserve() public {
        // First do a V1 gobble
        vm.startPrank(seller);
        warplets.approve(address(auction), TOKEN_ID);
        auction.gobble(TOKEN_ID, 0);
        vm.stopPrank();

        paymentToken.mint(address(auction), POT);

        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        vm.prank(address(hook));
        vm.expectRevert("NFT already in reserve");
        auction.gobbleFlash(TOKEN_ID);
    }

    function test_flash_with_empty_pot_pays_zero_and_succeeds() public {
        // Deploy auction with empty pot
        DutchAuctionV2 emptyAuction = new DutchAuctionV2(
            address(warplets), address(paymentToken), address(reserve), feeHandler
        );
        assertEq(emptyAuction.currentPrice(), 0);

        uint256 freshId = 99;
        warplets.mint(address(this), freshId);
        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        warplets.transferFrom(address(this), address(hook), freshId);

        vm.prank(address(hook));
        emptyAuction.gobbleFlash(freshId);

        assertEq(warplets.ownerOf(freshId), address(reserve));
        assertEq(paymentToken.balanceOf(address(hook)), 0);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Reentrancy scenarios
    // ═════════════════════════════════════════════════════════════════

    function test_flash_reentrant_flash_reverts() public {
        uint256 secondId = 100;
        warplets.mint(address(this), secondId);

        ReentrantFlashHook hook = new ReentrantFlashHook(address(auction));
        hook.setReenterTokenId(secondId);

        // Give first NFT to hook
        vm.prank(seller);
        warplets.transferFrom(seller, address(hook), TOKEN_ID);

        // Hook receives payout, tries to re-enter gobbleFlash(secondId).
        // Inner call: pot is 0, sends 0 tokens, but hook doesn't deliver secondId → reverts.
        // Outer call also reverts because TOKEN_ID never reached reserve.
        vm.prank(address(hook));
        vm.expectRevert();
        auction.gobbleFlash(TOKEN_ID);
    }

    function test_flash_reentrant_via_v1_gobble_reverts() public {
        uint256 secondId = 100;
        ReentrantOriginalGobbleHook hook = new ReentrantOriginalGobbleHook(
            address(auction), address(warplets)
        );
        vm.prank(seller);
        warplets.transferFrom(seller, address(hook), TOKEN_ID);
        warplets.mint(address(hook), secondId);
        hook.setReenterTokenId(secondId);

        // Hook receives payout via tokensReceived, then calls gobble(secondId, 0)
        // via V1 path. Inside onERC721Received, payout = currentPrice() = 0,
        // minPrice = 0, so 0 >= 0 passes. secondId goes to reserve. Hook gets 0 more.
        // But back in the outer flash call, TOKEN_ID still isn't in reserve → reverts.
        vm.prank(address(hook));
        vm.expectRevert("NFT not in reserve yet");
        auction.gobbleFlash(TOKEN_ID);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Sequential: mixing V1 and flash paths
    // ═════════════════════════════════════════════════════════════════

    function test_flash_then_v1_after_refill() public {
        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        vm.prank(seller);
        warplets.transferFrom(seller, address(hook), TOKEN_ID);
        vm.prank(address(hook));
        auction.gobbleFlash(TOKEN_ID);
        assertEq(auction.currentPrice(), 0);

        // Refill pot
        paymentToken.mint(address(auction), POT);

        // V1 gobble a different token
        uint256 secondId = 200;
        address secondSeller = makeAddr("secondSeller");
        warplets.mint(secondSeller, secondId);
        vm.startPrank(secondSeller);
        warplets.approve(address(auction), secondId);
        auction.gobble(secondId, POT);
        vm.stopPrank();

        assertEq(warplets.ownerOf(secondId), address(reserve));
        assertEq(paymentToken.balanceOf(secondSeller), POT);
    }

    function test_v1_then_flash_after_refill() public {
        vm.startPrank(seller);
        warplets.approve(address(auction), TOKEN_ID);
        auction.gobble(TOKEN_ID, POT);
        vm.stopPrank();

        paymentToken.mint(address(auction), POT);

        uint256 secondId = 200;
        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        warplets.mint(address(hook), secondId);
        vm.prank(address(hook));
        auction.gobbleFlash(secondId);

        assertEq(warplets.ownerOf(secondId), address(reserve));
        assertEq(paymentToken.balanceOf(address(hook)), POT);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Constructor / views
    // ═════════════════════════════════════════════════════════════════

    function test_constructor_sets_feeHandler_allowance() public view {
        assertEq(paymentToken.allowance(address(auction), feeHandler), type(uint256).max);
    }

    function test_currentPrice_equals_balance() public view {
        assertEq(auction.currentPrice(), POT);
    }

    function test_currentPrice_zero_after_flash() public {
        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        vm.prank(seller);
        warplets.transferFrom(seller, address(hook), TOKEN_ID);
        vm.prank(address(hook));
        auction.gobbleFlash(TOKEN_ID);
        assertEq(auction.currentPrice(), 0);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Edge cases
    // ═════════════════════════════════════════════════════════════════

    function test_flash_reverts_for_eoa_caller() public {
        // EOA has no code — ERC-777 send doesn't call tokensReceived for EOAs,
        // so the NFT is never delivered. Postcondition fails.
        address eoa = makeAddr("eoa");
        vm.prank(eoa);
        vm.expectRevert("NFT not in reserve yet");
        auction.gobbleFlash(TOKEN_ID);
    }

    function test_flash_reverts_for_nonexistent_token() public {
        GoodFlashHook hook = new GoodFlashHook(address(warplets));
        vm.prank(address(hook));
        vm.expectRevert(); // ownerOf reverts for nonexistent token
        auction.gobbleFlash(999);
    }
}
