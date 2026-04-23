// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FeeHandler} from "../src/FeeHandler.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockSuperToken is MockERC20 {
    address internal immutable host;

    constructor(address _host) MockERC20("Mock Super Token", "MST") {
        host = _host;
    }

    function getHost() external view returns (address) {
        return host;
    }
}

contract MockCFA {
    struct FlowData {
        uint256 timestamp;
        int96 flowRate;
        uint256 deposit;
        uint256 owedDeposit;
    }

    mapping(address token => mapping(address sender => mapping(address receiver => FlowData data))) internal _flows;

    function getFlow(address token, address sender, address receiver)
        external
        view
        returns (uint256 timestamp, int96 flowRate, uint256 deposit, uint256 owedDeposit)
    {
        FlowData memory d = _flows[token][sender][receiver];
        return (d.timestamp, d.flowRate, d.deposit, d.owedDeposit);
    }

    function createFlow(address token, address receiver, int96 flowRate, bytes calldata) external {
        _flows[token][msg.sender][receiver] = FlowData(block.timestamp, flowRate, 0, 0);
    }

    function updateFlow(address token, address receiver, int96 flowRate, bytes calldata) external {
        _flows[token][msg.sender][receiver] = FlowData(block.timestamp, flowRate, 0, 0);
    }

    function deleteFlow(address token, address sender, address receiver, bytes calldata) external {
        delete _flows[token][sender][receiver];
    }
}

contract MockGDA {
    function isPool(address, address) external pure returns (bool) {
        return false;
    }
}

contract MockSuperfluidHost {
    bytes32 internal constant CFA_V1 = keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    bytes32 internal constant GDA_V1 = keccak256("org.superfluid-finance.agreements.GeneralDistributionAgreement.v1");

    address internal immutable cfa;
    address internal immutable gda;

    constructor(address _cfa, address _gda) {
        cfa = _cfa;
        gda = _gda;
    }

    function getAgreementClass(bytes32 agreementType) external view returns (address) {
        if (agreementType == CFA_V1) return cfa;
        if (agreementType == GDA_V1) return gda;
        return address(0);
    }

    function callAgreement(address agreementClass, bytes calldata callData, bytes calldata)
        external
        returns (bytes memory returnedData)
    {
        // Host acts as forwarder so CFA sees the app (FeeHandler) as sender.
        (bool ok, bytes memory ret) = agreementClass.call(callData);
        require(ok, "agreement-call-failed");
        return ret;
    }
}

contract MockLPFactory {
    MockERC20 internal immutable weth;
    uint256 internal rewardAmount;

    constructor(address _weth) {
        weth = MockERC20(_weth);
    }

    function setRewardAmount(uint256 amount) external {
        rewardAmount = amount;
    }

    function claimRewards(address) external {
        if (rewardAmount > 0) weth.mint(msg.sender, rewardAmount);
    }
}

contract MockStremeZap {
    MockERC20 internal immutable weth;
    MockSuperToken internal immutable streme;
    uint256 internal immutable outMultiplier;

    address internal lastStremeCoin;
    uint256 internal lastAmountIn;
    uint256 internal lastAmountOutMin;
    address internal lastStakingContract;

    constructor(address _weth, address _streme, uint256 _outMultiplier) {
        weth = MockERC20(_weth);
        streme = MockSuperToken(_streme);
        outMultiplier = _outMultiplier;
    }

    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract)
        external
        payable
        returns (uint256 amountOut)
    {
        lastStremeCoin = stremeCoin;
        lastAmountIn = amountIn;
        lastAmountOutMin = amountOutMin;
        lastStakingContract = stakingContract;

        weth.transferFrom(msg.sender, address(this), amountIn);
        amountOut = amountIn * outMultiplier;
        require(amountOut >= amountOutMin, "min-out");
        // Match StremeZapUniversal: zero staking = output to `msg.sender`; non-zero = old path minted to staking address.
        address to = stakingContract == address(0) ? msg.sender : stakingContract;
        streme.mint(to, amountOut);
    }

    function getLastCall() external view returns (address, uint256, uint256, address) {
        return (lastStremeCoin, lastAmountIn, lastAmountOutMin, lastStakingContract);
    }
}

contract MockAuctionApprover {
    function approveToken(address token, address spender, uint256 amount) external {
        ERC20(token).approve(spender, amount);
    }
}

contract FeeHandlerTest is Test {
    MockERC20 internal weth;
    MockSuperToken internal streme;
    MockCFA internal cfa;
    MockGDA internal gda;
    MockSuperfluidHost internal host;
    MockLPFactory internal lpFactory;
    MockStremeZap internal zap;
    MockAuctionApprover internal oldAuction;

    FeeHandler internal handler;

    address internal admin = makeAddr("admin");
    address internal rebalancer = makeAddr("rebalancer");
    address internal stranger = makeAddr("stranger");
    address internal newAuction = makeAddr("newAuction");

    uint256 internal constant TARGET_DURATION = 7 days;
    uint256 internal constant MIN_TOKEN_OUT = 100e18;

    function setUp() public {
        cfa = new MockCFA();
        gda = new MockGDA();
        host = new MockSuperfluidHost(address(cfa), address(gda));
        weth = new MockERC20("Mock WETH", "WETH");
        streme = new MockSuperToken(address(host));
        lpFactory = new MockLPFactory(address(weth));
        zap = new MockStremeZap(address(weth), address(streme), 2);
        oldAuction = new MockAuctionApprover();

        handler = new FeeHandler(
            address(weth),
            address(streme),
            address(lpFactory),
            address(oldAuction),
            address(zap),
            TARGET_DURATION,
            admin,
            rebalancer
        );
    }

    function test_constructor_sets_roles_and_approvals() public view {
        assertTrue(handler.hasRole(handler.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(handler.hasRole(handler.REBALANCER_ROLE(), rebalancer));
        assertEq(weth.allowance(address(handler), address(zap)), type(uint256).max);
        assertTrue(handler.streamActive());
    }

    function test_constructor_reverts_on_zero_target_duration() public {
        vm.expectRevert(FeeHandler.InvalidDuration.selector);
        new FeeHandler(
            address(weth), address(streme), address(lpFactory), address(oldAuction), address(zap), 0, admin, rebalancer
        );
    }

    function test_setAuction_moves_balance_and_deactivates_stream() public {
        uint256 oldBal = 1_234e18;
        streme.mint(address(oldAuction), oldBal);
        oldAuction.approveToken(address(streme), address(handler), type(uint256).max);

        vm.expectEmit(true, true, false, true, address(handler));
        emit FeeHandler.AuctionUpdated(address(oldAuction), newAuction);

        vm.prank(admin);
        handler.setAuction(newAuction);

        assertEq(streme.balanceOf(address(oldAuction)), 0);
        assertEq(streme.balanceOf(address(handler)), oldBal);
        assertEq(handler.auction(), newAuction);
        assertFalse(handler.streamActive());
    }

    function test_setAuction_reverts_for_stranger_even_if_old_auction_has_balance() public {
        uint256 oldBal = 1_234e18;
        streme.mint(address(oldAuction), oldBal);
        oldAuction.approveToken(address(streme), address(handler), type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, handler.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(stranger);
        handler.setAuction(newAuction);

        assertEq(streme.balanceOf(address(oldAuction)), oldBal);
        assertEq(streme.balanceOf(address(handler)), 0);
        assertEq(handler.auction(), address(oldAuction));
    }

    function test_rebalanceFlowRate_reverts_when_stream_inactive() public {
        vm.prank(admin);
        handler.setAuction(newAuction);

        vm.expectRevert(FeeHandler.StreamNotActive.selector);
        handler.rebalanceFlowRate();
    }

    function test_rebalance_reverts_for_stranger() public {
        vm.prank(stranger);
        vm.expectRevert(FeeHandler.UnauthorizedRebalance.selector);
        handler.rebalance(1);
    }

    function test_startStream_only_admin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, handler.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(stranger);
        handler.startStream();
    }

    // function test_claimRewardsAndSwapWethToToken_uses_minTokenOut_and_swaps_all() public {
    //     uint256 reward = 100e18;
    //     lpFactory.setRewardAmount(reward);

    //     handler.claimRewardsAndSwapWethToToken();

    //     assertEq(weth.balanceOf(address(handler)), 0);
    //     assertEq(streme.balanceOf(address(handler)), reward * 2);

    //     (address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) = zap.getLastCall();
    //     assertEq(stremeCoin, address(streme));
    //     assertEq(amountIn, reward);
    //     assertEq(amountOutMin, MIN_TOKEN_OUT);
    //     assertEq(stakingContract, address(0));
    // }

    function test_rebalance_reverts_when_amount_in_exceeds_uint128() public {
        weth.mint(address(handler), uint256(type(uint128).max) + 1);

        vm.prank(rebalancer);
        vm.expectRevert(FeeHandler.AmountInTooLarge.selector);
        handler.rebalance(1);
    }

    /// @notice `rebalanceFlowRate` is intentionally permissionless while stream is active.
    function test_rebalanceFlowRate_is_permissionless_when_stream_active() public {
        vm.prank(stranger);
        handler.rebalanceFlowRate();
    }
}
