# ClawdFundMe

A community crowdfunding platform built on Base where contributors stake CLAWD tokens behind project proposals. When a funding goal is met, the builder has a fixed delivery window to ship. An owner grades the delivery 1–10; the contract burns a quality-proportional cut of the escrowed CLAWD and releases the remainder to the builder.

Built with [Scaffold-ETH 2](https://scaffoldeth.io) on [Base](https://base.org).

## How it works

1. Anyone submits a proposal with a description, CLAWD funding goal, and delivery window (1 week, 2 weeks, or 1 month).
2. Contributors approve and fund the proposal in CLAWD. Once the goal is reached the deadline clock starts.
3. The builder ships and marks delivery; the owner grades 1–10.
4. The contract burns `(10 - score) / 10` of the escrowed CLAWD to the dead address and sends the rest to the builder.
5. If the owner cancels a proposal, contributors can pull their CLAWD back via `refund()`.

## Contracts

- **ClawdFundMe** — main escrow and grading contract (Base mainnet)
- **MockCLAWD** — ERC-20 used in local development (chain 31337 only)

## Local development

```bash
yarn install
yarn chain          # start local Anvil fork
yarn deploy         # deploy contracts to local network
yarn start          # start Next.js at http://localhost:3000
```

## Running tests

```bash
cd packages/foundry
forge test
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Recommended | Alchemy key for Base RPC |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Recommended | WalletConnect project ID |
| `VERCEL_PROJECT_PRODUCTION_URL` | Production | Set by Vercel; used for OG image URLs |

## Known Issues

- **No contributor escape hatch**: Contributor funds are locked until the owner calls `cancelProposal`. There is no on-chain way for contributors to withdraw if the owner is unresponsive.
- **`ProposalStatus.GRADED` is unreachable**: The `grade()` function transitions directly from `FUNDED` to `SETTLED`; the `GRADED` enum value is never written.
- **O(n) view functions**: `activeProposals()` and `allProposals()` loop over all proposals; for very large proposal counts these may exceed `eth_call` gas limits.
- **`BLOCKS_PER_DAY` constant mismatch**: The constant assumes ~12 s/block; Base's actual cadence is ~2 s. The owner must supply `lateBlocks` relative to Base's true block rate.
- **Connect wallet as alert**: Disconnected users see a warning banner rather than a connect button in the action slot; the header connect button is the primary entry point.
- **No USD conversion**: CLAWD amounts are shown without a fiat equivalent; a CLAWD price feed is not available.
- **OG title template**: Sub-page tab titles still read "… | Scaffold-ETH 2" until the `titleTemplate` in `getMetadata.ts` is updated.
- **OG image on IPFS**: When deployed to IPFS without `VERCEL_PROJECT_PRODUCTION_URL` set, the OG image URL resolves to `localhost:3000` and link unfurling breaks.
- **No Phantom connector**: Phantom wallet is not in the RainbowKit connector list; mobile users on non-in-app browsers may have a degraded experience.
- **Default WalletConnect project ID**: Falls back to a shared default if `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` is unset; set your own project ID in Vercel env config for production.
- **No reentrancy test**: `nonReentrant` guards are applied to `fund`, `grade`, and `refund`, but reentrancy via the CLAWD ERC20 is not exercised by the test suite.
