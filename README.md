# ClawdFundMe

A self-grading project crowdfund on Base. Community members escrow CLAWD tokens behind project proposals. When a project is delivered, the owner scores it 1–10. The contract burns a quality-proportional cut of the escrowed CLAWD and pays the remainder to the builder. Late delivery adds an extra burn penalty. Score 10 keeps everything; score 0 burns everything.

## Live

**App:** https://bafybeiejkdkrp7iphsvltm4c6zxbnco6b52l7fmpsrvtrwyuupjs2j7jbm.ipfs.community.bgipfs.com/

**Contract:** [`0xf9673e91c7c1141eea93b77ae1fc6abf02aa4f75`](https://basescan.org/address/0xf9673e91c7c1141eea93b77ae1fc6abf02aa4f75) on Base

## How it works

1. **Propose** — anyone calls `propose()` with a description, CLAWD funding goal, and delivery window.
2. **Fund** — contributors approve CLAWD and call `fund(proposalId, amount)`. Contributions are clamped to the remaining goal. Once the goal is met the deadline clock starts.
3. **Grade** — owner calls `grade(proposalId, score, lateBlocks, builder)` after delivery. The contract computes:
   - **Score burn:** `funded × (10 − score) / 10`
   - **Late burn:** `5% per day late`, capped at 50%
   - Total burn capped at 100% of funded
   - Burns to `0x000…dEaD`, transfers remainder to the builder.
4. **Cancel / Refund** — owner can cancel an open or funded proposal; contributors pull their CLAWD back with `refund()`.

The frontend shows a live proposals feed sorted by funding progress, contributor lists, a graded-proposals tab with color-coded score badges, and leaderboards for top builders and funders.

## CLAWD token

`0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07` on Base

## Tech stack

- **Contracts:** Solidity 0.8.20, OpenZeppelin (Ownable, ReentrancyGuard, SafeERC20), Foundry
- **Frontend:** Next.js (App Router), Scaffold-ETH 2, Wagmi, Viem, RainbowKit, Tailwind CSS + DaisyUI
- **Hosting:** IPFS via bgipfs

## Run locally

### Prerequisites

- Node ≥ 18, Yarn
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)

### Install and start

```bash
yarn install

# Terminal 1 — local Anvil node
yarn chain

# Terminal 2 — deploy contracts
yarn deploy

# Terminal 3 — Next.js dev server
yarn start
```

Open http://localhost:3000.

### Tests

```bash
cd packages/foundry && forge test
```

### Deploy to Base

Add to `packages/foundry/.env`:

```
DEPLOYER_PRIVATE_KEY=...
ALCHEMY_API_KEY=...
ETHERSCAN_API_KEY=...
```

```bash
yarn deploy --network base
yarn verify --network base
```
