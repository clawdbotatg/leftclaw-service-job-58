# Build Plan — Job #58

## Client
0x7E6Db18aea6b54109f4E5F34242d4A8786E0C471

## Spec
ClawdFundMe — Self-Grading Project Crowdfund. Build and deploy a ClawdFundMe.sol contract + frontend on Base. Community members fund project proposals by sending CLAWD to an escrow. When the project is done, the AI agent self-grades its work on a 1-10 scale. The contract burns CLAWD proportional to the quality deficit — a perfect 10 keeps everything, lower scores burn more. Late delivery adds an extra burn penalty. Repeats for every proposal.

CONTRACT: ClawdFundMe.sol

PROPOSAL LIFECYCLE:
1. Anyone calls propose() to submit a project idea with a funding goal and deadline.
2. Community funds the proposal by calling fund(proposalId) sending CLAWD.
3. Once funding goal is met, builder has until deadline to deliver.
4. After delivery (or deadline passes), owner wallet calls grade(proposalId, score, lateBlocks) to score the work.
5. Contract burns proportional cut, releases remainder to builder.

STATE PER PROPOSAL:
- uint256 id
- address proposer — wallet that submitted
- address builder — wallet that will receive payment (set by owner at grade time, defaults to proposer)
- string description — project description
- uint256 fundingGoal — CLAWD amount needed to activate
- uint256 funded — total CLAWD contributed so far
- uint256 deadline — block.timestamp deadline for delivery (set when goal is reached)
- uint256 duration — seconds builder has to deliver once funded (set by proposer)
- mapping(address => uint256) contributions — how much each address contributed
- uint8 score — 1-10, set by owner at grade time (0 = not yet graded)
- bool delivered — set true by owner when calling grade
- bool settled — true after payout executed
- ProposalStatus status — enum: OPEN, FUNDED, GRADED, SETTLED, CANCELLED

BURN SCHEDULE (applied to total funded amount):
- Score 10: burn 0% — builder keeps everything
- Score 9: burn 10%
- Score 8: burn 20%
- Score 7: burn 30%
- Score 6: burn 40%
- Score 5: burn 50%
- Score 4: burn 60%
- Score 3: burn 70%
- Score 2: burn 80%
- Score 1: burn 90%
- Score 0 (project failed / not delivered): burn 100%
Formula: burnAmount = funded * (10 - score) / 10

LATE PENALTY: If builder delivers after deadline, an additional 5% is burned per day late (floor to nearest day, capped at 50% additional). Late penalty applied on top of score burn, total burn capped at 100%.
lateBlocks passed by owner to grade(). lateDays = lateBlocks / 7200 (approx Base blocks per day).
lateBurnExtra = min(lateDays * 5, 50)% of funded.
totalBurn = min(scoreBurn + lateBurnExtra, funded).

FUNCTIONS:
propose(string calldata description, uint256 fundingGoal, uint256 durationSeconds) — public. fundingGoal must be > 0. Creates proposal with status OPEN. Emits Proposed(id, msg.sender, fundingGoal, description).

fund(uint256 proposalId) — public, proposal status must be OPEN. Transfers msg.value-equivalent CLAWD (caller specifies amount via separate approve+transfer, or contract pulls approved amount passed as param: fund(proposalId, uint256 amount)). Adds to funded and contributions[msg.sender]. If funded >= fundingGoal after this contribution: set status = FUNDED, deadline = block.timestamp + duration. Emits Funded(proposalId, msg.sender, amount, funded). Emits GoalReached(proposalId, deadline) if just tipped over.

grade(uint256 proposalId, uint8 score, uint256 lateBlocks, address builder) — owner only. Proposal must be FUNDED. score must be 0-10. Computes burnAmount and builderAmount per schedule above. Burns burnAmount to address(0). Transfers builderAmount to builder address. Sets status = GRADED then SETTLED. Emits Graded(proposalId, score, lateBlocks, burnAmount, builderAmount, builder).

cancelProposal(uint256 proposalId) — owner only, status OPEN or FUNDED. Refunds all contributors proportionally from funded amount. Sets status = CANCELLED. Emits Cancelled(proposalId).

refund(uint256 proposalId) — public, only if status CANCELLED. Sends contributions[msg.sender] back to caller.

getProposal(uint256 proposalId) — view, returns full proposal state.
getContribution(uint256 proposalId, address contributor) — view, returns contribution amount.
activeProposals() — view, returns array of proposal IDs with status OPEN or FUNDED.

CLAWD token on Base: 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07. Burn to address(0).

FRONTEND:
Proposals feed: list of all active proposals sorted by funded/fundingGoal percentage (most funded first). Each card shows: description, proposer address, funding progress bar (X CLAWD of Y goal), time remaining until deadline (if funded), status badge. Clicking a card expands to show full description, all contributors and amounts, and a Fund This button.

Fund panel: input for CLAWD amount, approve + fund buttons, shows your current contribution to this proposal.

Submit proposal panel: form with description textarea, funding goal input (CLAWD), duration selector (1 week / 2 weeks / 1 month). Submit button calls propose().

Graded proposals: separate tab showing completed proposals with score badge (color coded: green=8-10, yellow=5-7, red=1-4, grey=0), burn amount, builder payout, late penalty if any.

Leaderboard: top builders by total CLAWD earned across all graded proposals. Top funders by total CLAWD contributed.

Stack: scaffold-eth 2, Next.js, wagmi/viem. Deploy to Vercel.

Deploy contract to Base mainnet, verify on Basescan. Owner wallet: 0x7E6Db18aea6b54109f4E5F34242d4A8786E0C471. No proxy needed.

## Deploy
- Chain: Base (8453)
- RPC: Alchemy (ALCHEMY_API_KEY in .env)
- Deployer: 0x7a8b288AB00F5b469D45A82D4e08198F6Eec651C (DEPLOYER_PRIVATE_KEY in .env)
- All owner/admin/treasury roles transfer to client: 0x7E6Db18aea6b54109f4E5F34242d4A8786E0C471
