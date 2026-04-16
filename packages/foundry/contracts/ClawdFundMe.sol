// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClawdFundMe — self-grading project crowdfund in CLAWD
/// @notice Community escrows CLAWD for project proposals; owner grades delivery
///         1-10, contract burns a quality-proportional cut, releases remainder
///         to the builder.
contract ClawdFundMe is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum ProposalStatus {
        OPEN,
        FUNDED,
        /// @notice Known issue: This status is never written; grade() transitions directly from FUNDED to SETTLED, leaving GRADED unreachable.
        GRADED,
        SETTLED,
        CANCELLED
    }

    struct Proposal {
        uint256 id;
        address proposer;
        address builder;
        string description;
        uint256 fundingGoal;
        uint256 funded;
        uint256 deadline;
        uint256 duration;
        uint8 score;
        bool delivered;
        bool settled;
        ProposalStatus status;
    }

    struct ProposalView {
        uint256 id;
        address proposer;
        address builder;
        string description;
        uint256 fundingGoal;
        uint256 funded;
        uint256 deadline;
        uint256 duration;
        uint8 score;
        bool delivered;
        bool settled;
        ProposalStatus status;
        uint256 burnAmount;
        uint256 builderAmount;
        uint256 lateBlocks;
    }

    // Dead address used as burn sink; many ERC20 impls revert on transfer to
    // address(0), so a non-recoverable burn address is the portable choice.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    /// @notice Known issue: BLOCKS_PER_DAY = 7200 assumes ~12 s/block but Base's cadence is ~2 s; the owner must supply lateBlocks in units consistent with Base's true block rate, not this constant.
    uint256 public constant BLOCKS_PER_DAY = 7200;
    uint256 public constant LATE_BURN_PER_DAY_PERCENT = 5;
    uint256 public constant MAX_LATE_BURN_PERCENT = 50;
    uint8 public constant MAX_SCORE = 10;
    // Bound duration so `block.timestamp + duration` never overflows and
    // proposals can't be parked indefinitely (365 days is plenty for a grant).
    uint256 public constant MAX_DURATION = 365 days;

    IERC20 public immutable clawd;

    uint256 public proposalCount;

    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => uint256)) private _contributions;
    mapping(uint256 => address[]) private _contributors;
    mapping(uint256 => mapping(address => bool)) private _hasContributed;

    mapping(uint256 => uint256) public proposalBurnAmount;
    mapping(uint256 => uint256) public proposalBuilderAmount;
    mapping(uint256 => uint256) public proposalLateBlocks;

    event Proposed(uint256 indexed id, address indexed proposer, uint256 fundingGoal, string description);
    event Funded(uint256 indexed proposalId, address indexed contributor, uint256 amount, uint256 totalFunded);
    event GoalReached(uint256 indexed proposalId, uint256 deadline);
    event Graded(
        uint256 indexed proposalId,
        uint8 score,
        uint256 lateBlocks,
        uint256 burnAmount,
        uint256 builderAmount,
        address indexed builder
    );
    event Cancelled(uint256 indexed proposalId);
    event Refunded(uint256 indexed proposalId, address indexed contributor, uint256 amount);

    error ZeroAddress();
    error InvalidFundingGoal();
    error InvalidDuration();
    error InvalidAmount();
    error ProposalNotOpen();
    error ProposalNotFunded();
    error ProposalNotCancellable();
    error ProposalNotCancelled();
    error InvalidScore();
    error NothingToRefund();
    error UnknownProposal();

    constructor(address clawdToken, address initialOwner) Ownable(initialOwner) {
        /// @notice Known issue: The initialOwner == address(0) branch is unreachable; OZ Ownable's constructor already reverts with OwnableInvalidOwner before this guard runs.
        if (clawdToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        clawd = IERC20(clawdToken);
    }

    /// @notice Submit a new project proposal. Anyone can call.
    function propose(string calldata description, uint256 fundingGoal, uint256 durationSeconds)
        external
        returns (uint256 id)
    {
        if (fundingGoal == 0) revert InvalidFundingGoal();
        if (durationSeconds == 0 || durationSeconds > MAX_DURATION) revert InvalidDuration();

        id = ++proposalCount;
        Proposal storage p = _proposals[id];
        p.id = id;
        p.proposer = msg.sender;
        p.builder = msg.sender;
        p.description = description;
        p.fundingGoal = fundingGoal;
        p.duration = durationSeconds;
        p.status = ProposalStatus.OPEN;

        emit Proposed(id, msg.sender, fundingGoal, description);
    }

    /// @notice Pledge CLAWD to a proposal. Caller must have approved `amount`.
    ///         Contribution is clamped to the remaining funding goal.
    function fund(uint256 proposalId, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        Proposal storage p = _proposals[proposalId];
        if (p.id == 0) revert UnknownProposal();
        if (p.status != ProposalStatus.OPEN) revert ProposalNotOpen();

        uint256 remaining = p.fundingGoal - p.funded;
        uint256 take = amount > remaining ? remaining : amount;
        // Frontrun guard: if someone else filled the goal first, `remaining`
        // (and thus `take`) can be 0. Revert so the late caller isn't griefed
        // into a zero-value transfer and contributor-list pollution.
        if (take == 0) revert InvalidAmount();

        if (!_hasContributed[proposalId][msg.sender]) {
            _hasContributed[proposalId][msg.sender] = true;
            _contributors[proposalId].push(msg.sender);
        }
        _contributions[proposalId][msg.sender] += take;
        p.funded += take;

        bool reachedGoal = p.funded >= p.fundingGoal;
        if (reachedGoal) {
            p.status = ProposalStatus.FUNDED;
            p.deadline = block.timestamp + p.duration;
        }

        clawd.safeTransferFrom(msg.sender, address(this), take);

        emit Funded(proposalId, msg.sender, take, p.funded);
        if (reachedGoal) emit GoalReached(proposalId, p.deadline);
    }

    /// @notice Owner scores a delivered proposal, burning a quality-proportional
    ///         cut and paying the remainder to the builder.
    /// @param score 0..10 (0 = failed / not delivered, 10 = perfect)
    /// @param lateBlocks block lateness relative to deadline; owner supplies
    /// @param builder_ payout recipient; address(0) defaults to the proposer
    function grade(uint256 proposalId, uint8 score, uint256 lateBlocks, address builder_)
        external
        onlyOwner
        nonReentrant
    {
        if (score > MAX_SCORE) revert InvalidScore();
        Proposal storage p = _proposals[proposalId];
        if (p.status != ProposalStatus.FUNDED) revert ProposalNotFunded();

        address payoutBuilder = builder_ == address(0) ? p.proposer : builder_;
        uint256 funded = p.funded;

        uint256 scoreBurn = (funded * (MAX_SCORE - score)) / MAX_SCORE;

        uint256 lateDays = lateBlocks / BLOCKS_PER_DAY;
        uint256 latePct = lateDays * LATE_BURN_PER_DAY_PERCENT;
        if (latePct > MAX_LATE_BURN_PERCENT) latePct = MAX_LATE_BURN_PERCENT;
        uint256 lateBurnExtra = (funded * latePct) / 100;

        uint256 totalBurn = scoreBurn + lateBurnExtra;
        if (totalBurn > funded) totalBurn = funded;
        uint256 builderAmount = funded - totalBurn;

        p.builder = payoutBuilder;
        p.score = score;
        p.delivered = true;
        p.settled = true;
        p.status = ProposalStatus.SETTLED;
        proposalBurnAmount[proposalId] = totalBurn;
        proposalBuilderAmount[proposalId] = builderAmount;
        proposalLateBlocks[proposalId] = lateBlocks;

        if (totalBurn > 0) clawd.safeTransfer(BURN_ADDRESS, totalBurn);
        if (builderAmount > 0) clawd.safeTransfer(payoutBuilder, builderAmount);

        emit Graded(proposalId, score, lateBlocks, totalBurn, builderAmount, payoutBuilder);
    }

    /// @notice Owner cancels an open or funded proposal. Contributors must
    ///         pull their CLAWD back via refund().
    function cancelProposal(uint256 proposalId) external onlyOwner {
        Proposal storage p = _proposals[proposalId];
        if (p.id == 0) revert UnknownProposal();
        if (p.status != ProposalStatus.OPEN && p.status != ProposalStatus.FUNDED) revert ProposalNotCancellable();
        p.status = ProposalStatus.CANCELLED;
        emit Cancelled(proposalId);
    }

    /// @notice Known issue: Contributor funds are locked until the owner calls cancelProposal; contributors have no on-chain escape hatch if the owner is unresponsive.
    /// @notice Contributor withdraws their CLAWD from a cancelled proposal.
    function refund(uint256 proposalId) external nonReentrant {
        Proposal storage p = _proposals[proposalId];
        if (p.status != ProposalStatus.CANCELLED) revert ProposalNotCancelled();
        uint256 amount = _contributions[proposalId][msg.sender];
        if (amount == 0) revert NothingToRefund();
        _contributions[proposalId][msg.sender] = 0;
        clawd.safeTransfer(msg.sender, amount);
        emit Refunded(proposalId, msg.sender, amount);
    }

    function getProposal(uint256 proposalId) external view returns (ProposalView memory v) {
        Proposal storage p = _proposals[proposalId];
        v = ProposalView({
            id: p.id,
            proposer: p.proposer,
            builder: p.builder,
            description: p.description,
            fundingGoal: p.fundingGoal,
            funded: p.funded,
            deadline: p.deadline,
            duration: p.duration,
            score: p.score,
            delivered: p.delivered,
            settled: p.settled,
            status: p.status,
            burnAmount: proposalBurnAmount[proposalId],
            builderAmount: proposalBuilderAmount[proposalId],
            lateBlocks: proposalLateBlocks[proposalId]
        });
    }

    function getContribution(uint256 proposalId, address contributor) external view returns (uint256) {
        return _contributions[proposalId][contributor];
    }

    function getContributors(uint256 proposalId) external view returns (address[] memory) {
        return _contributors[proposalId];
    }

    /// @notice Known issue: activeProposals() and allProposals() are O(proposalCount); may exceed eth_call gas limits for very large proposal sets.
    /// @notice IDs of proposals currently accepting funding or awaiting grading.
    function activeProposals() external view returns (uint256[] memory ids) {
        uint256 total = proposalCount;
        uint256 n;
        for (uint256 i = 1; i <= total; i++) {
            ProposalStatus s = _proposals[i].status;
            if (s == ProposalStatus.OPEN || s == ProposalStatus.FUNDED) n++;
        }
        ids = new uint256[](n);
        uint256 j;
        for (uint256 i = 1; i <= total; i++) {
            ProposalStatus s = _proposals[i].status;
            if (s == ProposalStatus.OPEN || s == ProposalStatus.FUNDED) {
                ids[j++] = i;
            }
        }
    }

    /// @notice All proposal IDs, oldest first. Useful for frontend pagination.
    function allProposals() external view returns (uint256[] memory ids) {
        uint256 total = proposalCount;
        ids = new uint256[](total);
        for (uint256 i = 0; i < total; i++) {
            ids[i] = i + 1;
        }
    }
}
