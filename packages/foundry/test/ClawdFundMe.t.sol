// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ClawdFundMe } from "../contracts/ClawdFundMe.sol";
import { MockCLAWD } from "../contracts/MockCLAWD.sol";

contract ClawdFundMeTest is Test {
    ClawdFundMe internal clawdFundMe;
    MockCLAWD internal clawd;

    address internal owner = address(0xC1);
    address internal proposer = address(0xA1);
    address internal alice = address(0xA2);
    address internal bob = address(0xA3);
    address internal builder = address(0xB1);

    address internal constant BURN = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        clawd = new MockCLAWD();
        clawdFundMe = new ClawdFundMe(address(clawd), owner);

        clawd.mint(alice, 1_000_000 ether);
        clawd.mint(bob, 1_000_000 ether);

        vm.prank(alice);
        clawd.approve(address(clawdFundMe), type(uint256).max);
        vm.prank(bob);
        clawd.approve(address(clawdFundMe), type(uint256).max);
    }

    function _propose(uint256 goal, uint256 duration) internal returns (uint256 id) {
        vm.prank(proposer);
        id = clawdFundMe.propose("a project", goal, duration);
    }

    // --- constructor ---------------------------------------------------------

    function test_constructor_reverts_on_zero_token() public {
        vm.expectRevert(ClawdFundMe.ZeroAddress.selector);
        new ClawdFundMe(address(0), owner);
    }

    function test_constructor_reverts_on_zero_owner() public {
        // OZ Ownable's own guard fires first via the inherited constructor.
        vm.expectRevert(abi.encodeWithSignature("OwnableInvalidOwner(address)", address(0)));
        new ClawdFundMe(address(clawd), address(0));
    }

    // --- propose -------------------------------------------------------------

    function test_propose_creates_open_proposal() public {
        uint256 id = _propose(100 ether, 7 days);
        ClawdFundMe.ProposalView memory p = clawdFundMe.getProposal(id);
        assertEq(p.id, 1);
        assertEq(p.proposer, proposer);
        assertEq(p.builder, proposer);
        assertEq(p.fundingGoal, 100 ether);
        assertEq(p.duration, 7 days);
        assertEq(uint256(p.status), uint256(ClawdFundMe.ProposalStatus.OPEN));
        assertEq(clawdFundMe.proposalCount(), 1);
    }

    function test_propose_rejects_zero_goal() public {
        vm.prank(proposer);
        vm.expectRevert(ClawdFundMe.InvalidFundingGoal.selector);
        clawdFundMe.propose("x", 0, 7 days);
    }

    function test_propose_rejects_zero_duration() public {
        vm.prank(proposer);
        vm.expectRevert(ClawdFundMe.InvalidDuration.selector);
        clawdFundMe.propose("x", 1 ether, 0);
    }

    function test_propose_rejects_duration_above_cap() public {
        vm.prank(proposer);
        vm.expectRevert(ClawdFundMe.InvalidDuration.selector);
        clawdFundMe.propose("x", 1 ether, 365 days + 1);
    }

    function test_propose_accepts_max_duration() public {
        vm.prank(proposer);
        uint256 id = clawdFundMe.propose("x", 1 ether, 365 days);
        assertEq(clawdFundMe.getProposal(id).duration, 365 days);
    }

    // --- fund ----------------------------------------------------------------

    function test_fund_accumulates_and_flips_to_funded() public {
        uint256 id = _propose(100 ether, 7 days);

        vm.prank(alice);
        clawdFundMe.fund(id, 60 ether);

        ClawdFundMe.ProposalView memory p = clawdFundMe.getProposal(id);
        assertEq(p.funded, 60 ether);
        assertEq(uint256(p.status), uint256(ClawdFundMe.ProposalStatus.OPEN));
        assertEq(clawdFundMe.getContribution(id, alice), 60 ether);

        vm.prank(bob);
        clawdFundMe.fund(id, 40 ether);

        p = clawdFundMe.getProposal(id);
        assertEq(p.funded, 100 ether);
        assertEq(uint256(p.status), uint256(ClawdFundMe.ProposalStatus.FUNDED));
        assertEq(p.deadline, block.timestamp + 7 days);
        assertEq(clawdFundMe.getContributors(id).length, 2);
    }

    function test_fund_clamps_overfund_to_goal_remaining() public {
        uint256 id = _propose(100 ether, 7 days);
        uint256 aliceBefore = clawd.balanceOf(alice);

        vm.prank(alice);
        clawdFundMe.fund(id, 500 ether);

        ClawdFundMe.ProposalView memory p = clawdFundMe.getProposal(id);
        assertEq(p.funded, 100 ether);
        assertEq(uint256(p.status), uint256(ClawdFundMe.ProposalStatus.FUNDED));
        // only 100 should have been pulled
        assertEq(clawd.balanceOf(alice), aliceBefore - 100 ether);
    }

    function test_fund_rejects_zero_amount() public {
        uint256 id = _propose(100 ether, 7 days);
        vm.prank(alice);
        vm.expectRevert(ClawdFundMe.InvalidAmount.selector);
        clawdFundMe.fund(id, 0);
    }

    function test_fund_rejects_non_open_proposal() public {
        uint256 id = _propose(100 ether, 7 days);
        vm.prank(alice);
        clawdFundMe.fund(id, 100 ether);

        vm.prank(bob);
        vm.expectRevert(ClawdFundMe.ProposalNotOpen.selector);
        clawdFundMe.fund(id, 1 ether);
    }

    function test_fund_unknown_proposal_reverts() public {
        vm.prank(alice);
        vm.expectRevert(ClawdFundMe.UnknownProposal.selector);
        clawdFundMe.fund(42, 1 ether);
    }

    // --- grade ---------------------------------------------------------------

    function _fullyFund(uint256 goal, uint256 duration) internal returns (uint256 id) {
        id = _propose(goal, duration);
        vm.prank(alice);
        clawdFundMe.fund(id, goal);
    }

    function test_grade_score_10_pays_full_amount() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        uint256 builderBefore = clawd.balanceOf(builder);

        vm.prank(owner);
        clawdFundMe.grade(id, 10, 0, builder);

        assertEq(clawd.balanceOf(builder), builderBefore + 1000 ether);
        assertEq(clawd.balanceOf(BURN), 0);

        ClawdFundMe.ProposalView memory p = clawdFundMe.getProposal(id);
        assertEq(uint256(p.status), uint256(ClawdFundMe.ProposalStatus.SETTLED));
        assertEq(p.burnAmount, 0);
        assertEq(p.builderAmount, 1000 ether);
        assertEq(p.score, 10);
        assertTrue(p.delivered);
        assertTrue(p.settled);
        assertEq(p.builder, builder);
    }

    function test_grade_score_0_burns_everything() public {
        uint256 id = _fullyFund(1000 ether, 7 days);

        vm.prank(owner);
        clawdFundMe.grade(id, 0, 0, builder);

        assertEq(clawd.balanceOf(builder), 0);
        assertEq(clawd.balanceOf(BURN), 1000 ether);
    }

    function test_grade_score_7_burns_30_percent() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        vm.prank(owner);
        clawdFundMe.grade(id, 7, 0, builder);
        assertEq(clawd.balanceOf(BURN), 300 ether);
        assertEq(clawd.balanceOf(builder), 700 ether);
    }

    function test_grade_score_5_burns_50_percent() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        vm.prank(owner);
        clawdFundMe.grade(id, 5, 0, builder);
        assertEq(clawd.balanceOf(BURN), 500 ether);
        assertEq(clawd.balanceOf(builder), 500 ether);
    }

    function test_grade_late_adds_5_percent_per_day() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        // 2 days late = +10%. score 8 = 20% burn. total = 30%.
        vm.prank(owner);
        clawdFundMe.grade(id, 8, 2 * 7200, builder);
        assertEq(clawd.balanceOf(BURN), 300 ether);
        assertEq(clawd.balanceOf(builder), 700 ether);
    }

    function test_grade_late_caps_at_50_percent_extra() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        // 100 days late → capped at +50%. score 10 = 0% base burn → 50% total.
        vm.prank(owner);
        clawdFundMe.grade(id, 10, 100 * 7200, builder);
        assertEq(clawd.balanceOf(BURN), 500 ether);
        assertEq(clawd.balanceOf(builder), 500 ether);
    }

    function test_grade_total_burn_caps_at_funded() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        // score 1 = 90% burn; +50% late = would be 140%, cap to 100%.
        vm.prank(owner);
        clawdFundMe.grade(id, 1, 100 * 7200, builder);
        assertEq(clawd.balanceOf(BURN), 1000 ether);
        assertEq(clawd.balanceOf(builder), 0);
    }

    function test_grade_defaults_builder_to_proposer_when_zero_address() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        vm.prank(owner);
        clawdFundMe.grade(id, 10, 0, address(0));
        assertEq(clawd.balanceOf(proposer), 1000 ether);
    }

    function test_grade_rejects_bad_score() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        vm.prank(owner);
        vm.expectRevert(ClawdFundMe.InvalidScore.selector);
        clawdFundMe.grade(id, 11, 0, builder);
    }

    function test_grade_non_owner_reverts() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        vm.prank(alice);
        vm.expectRevert();
        clawdFundMe.grade(id, 10, 0, builder);
    }

    function test_grade_only_funded_status() public {
        uint256 id = _propose(1000 ether, 7 days);
        vm.prank(owner);
        vm.expectRevert(ClawdFundMe.ProposalNotFunded.selector);
        clawdFundMe.grade(id, 10, 0, builder);
    }

    function test_grade_twice_reverts() public {
        uint256 id = _fullyFund(1000 ether, 7 days);
        vm.prank(owner);
        clawdFundMe.grade(id, 10, 0, builder);
        vm.prank(owner);
        vm.expectRevert(ClawdFundMe.ProposalNotFunded.selector);
        clawdFundMe.grade(id, 10, 0, builder);
    }

    // --- cancel + refund -----------------------------------------------------

    function test_cancel_open_then_refund() public {
        uint256 id = _propose(100 ether, 7 days);
        vm.prank(alice);
        clawdFundMe.fund(id, 30 ether);
        vm.prank(bob);
        clawdFundMe.fund(id, 10 ether);

        vm.prank(owner);
        clawdFundMe.cancelProposal(id);

        uint256 aliceBefore = clawd.balanceOf(alice);
        vm.prank(alice);
        clawdFundMe.refund(id);
        assertEq(clawd.balanceOf(alice), aliceBefore + 30 ether);
        assertEq(clawdFundMe.getContribution(id, alice), 0);

        // Double refund fails
        vm.prank(alice);
        vm.expectRevert(ClawdFundMe.NothingToRefund.selector);
        clawdFundMe.refund(id);
    }

    function test_cancel_funded_status_allowed() public {
        uint256 id = _fullyFund(100 ether, 7 days);
        vm.prank(owner);
        clawdFundMe.cancelProposal(id);
        ClawdFundMe.ProposalView memory p = clawdFundMe.getProposal(id);
        assertEq(uint256(p.status), uint256(ClawdFundMe.ProposalStatus.CANCELLED));
    }

    function test_cancel_settled_reverts() public {
        uint256 id = _fullyFund(100 ether, 7 days);
        vm.prank(owner);
        clawdFundMe.grade(id, 10, 0, builder);
        vm.prank(owner);
        vm.expectRevert(ClawdFundMe.ProposalNotCancellable.selector);
        clawdFundMe.cancelProposal(id);
    }

    function test_refund_requires_cancelled() public {
        uint256 id = _propose(100 ether, 7 days);
        vm.prank(alice);
        clawdFundMe.fund(id, 30 ether);
        vm.prank(alice);
        vm.expectRevert(ClawdFundMe.ProposalNotCancelled.selector);
        clawdFundMe.refund(id);
    }

    function test_cancel_non_owner_reverts() public {
        uint256 id = _propose(100 ether, 7 days);
        vm.prank(alice);
        vm.expectRevert();
        clawdFundMe.cancelProposal(id);
    }

    // --- views ---------------------------------------------------------------

    function test_active_proposals_lists_open_and_funded() public {
        uint256 a = _propose(100 ether, 7 days);
        uint256 b = _propose(200 ether, 7 days);
        uint256 c = _propose(300 ether, 7 days);

        // b gets funded, c gets cancelled, a stays open
        vm.prank(alice);
        clawdFundMe.fund(b, 200 ether);
        vm.prank(owner);
        clawdFundMe.cancelProposal(c);

        uint256[] memory ids = clawdFundMe.activeProposals();
        assertEq(ids.length, 2);
        assertEq(ids[0], a);
        assertEq(ids[1], b);
    }

    function test_all_proposals_returns_every_id() public {
        _propose(100 ether, 7 days);
        _propose(200 ether, 7 days);
        uint256[] memory ids = clawdFundMe.allProposals();
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_fuzz_score_never_overpays(uint8 score, uint256 goal, uint256 lateBlocks) public {
        score = uint8(bound(uint256(score), 0, 10));
        goal = bound(goal, 1, 1_000_000 ether);
        lateBlocks = bound(lateBlocks, 0, 1000 * 7200);

        // Mint alice enough to cover goal.
        clawd.mint(alice, goal);
        vm.prank(alice);
        clawd.approve(address(clawdFundMe), type(uint256).max);

        uint256 id = _propose(goal, 7 days);
        vm.prank(alice);
        clawdFundMe.fund(id, goal);

        uint256 builderBefore = clawd.balanceOf(builder);
        uint256 burnBefore = clawd.balanceOf(BURN);

        vm.prank(owner);
        clawdFundMe.grade(id, score, lateBlocks, builder);

        uint256 paid = clawd.balanceOf(builder) - builderBefore;
        uint256 burned = clawd.balanceOf(BURN) - burnBefore;
        assertEq(paid + burned, goal);
    }
}
