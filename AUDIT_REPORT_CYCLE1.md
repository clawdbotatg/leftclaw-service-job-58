# Audit Report — Cycle 1

## MUST FIX

- [ ] **[CRITICAL]** Frontend target network excludes Base — `packages/nextjs/scaffold.config.ts:19` — `targetNetworks: [chains.foundry]` is the only entry. Once the contract is deployed to Base (8453), users connecting with Base will be treated as "wrong network" and the UI will not render reads/writes against the production contract. Must add `chains.base` (and, if desired, keep `chains.foundry` for local). Without this the dApp is unusable after deploy.

- [ ] **[CRITICAL]** Public RPC used for Base in Foundry config — `packages/foundry/foundry.toml:23` (and `:24` for `baseSepolia`) — `base = "https://mainnet.base.org"` is a public RPC. Project rules require Alchemy endpoints with `ALCHEMY_API_KEY`. Public RPCs are rate-limited, drop under load, and can cause failed `forge script --broadcast` runs mid-deploy (resulting in orphaned nonces / partial deploys). Replace with `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` (and `base-sepolia` equivalent).

## KNOWN ISSUES

- **[LOW]** No contributor-initiated refund for under-funded proposals — `packages/foundry/contracts/ClawdFundMe.sol:135-165` + `:221-229` — If a proposal sits in `OPEN` indefinitely without hitting its goal, contributor funds are locked until the owner calls `cancelProposal`. This is per the spec (`refund()` requires `CANCELLED`), but contributors have no on-chain escape hatch if the owner is unresponsive. Acceptable for an owner-trusted crowdfund; worth surfacing in the UI so funders understand the risk.

- **[LOW]** `ProposalStatus.GRADED` is unreachable — `packages/foundry/contracts/ClawdFundMe.sol:16-22`, `:199` — `grade()` jumps straight from `FUNDED` to `SETTLED`, so the `GRADED` enum value is never written. Dead state, harmless, but clutters the ABI and could confuse a future integrator reading the enum.

- **[LOW]** `activeProposals()` / `allProposals()` are O(proposalCount) — `packages/foundry/contracts/ClawdFundMe.sol:261-285` — Two full-sweep loops over every proposal. For the expected workload (tens to low-hundreds) this is fine. For very large state it could exceed eth_call gas and break the frontend feed; paginate if scale ever becomes a concern.

- **[LOW]** Late-penalty anchor is a hardcoded block-time constant — `packages/foundry/contracts/ClawdFundMe.sol:60`, `:186` — `BLOCKS_PER_DAY = 7200` assumes Base's current ~12 s/block cadence (actually ~2 s, which would make 7200 closer to 4 hours — see note). The `lateBlocks` input comes from the owner, so in practice the owner translates wall time into whatever `lateBlocks` value maps to 5%/day. Still, the on-chain constant doesn't match Base's true block rate and invites accidental misuse. Owner is trusted, so not a must-fix, but the naming/comments should reflect that this is an owner-supplied unit, not a physics constant.

- **[LOW]** Redundant `ZeroAddress` guard for `initialOwner` — `packages/foundry/contracts/ClawdFundMe.sol:107-110` — OZ `Ownable`'s own constructor reverts with `OwnableInvalidOwner(address(0))` before the local check ever runs. The local branch for `initialOwner == address(0)` is unreachable. Informational.

- **[INFO]** Approval button lacks post-confirmation cooldown — `packages/nextjs/components/clawdfundme/FundForm.tsx:28,131-135` — Only `isApproving` locks the button during the click-to-hash window. Between the wagmi receipt and the allowance refetch there is a brief window where `allowance` still reads stale `0` and the UI can flip back to "Approve" instead of "Fund". QA skill recommends an additional `approveCooldown` timer state. In practice the user just waits a second and retries; not a blocker.

- **[INFO]** "Connect your wallet" rendered as alert text instead of a Connect button in the action slot — `packages/nextjs/components/clawdfundme/FundForm.tsx:118-122` and `packages/nextjs/components/clawdfundme/SubmitProposal.tsx:108-112` — The QA skill prefers the primary action button to morph into a Connect button. Here users see a disabled action plus an info alert, while a prominent Connect button lives in the header. Functional but not the strict pattern.

- **[INFO]** No USD conversion next to CLAWD amounts — `packages/nextjs/components/clawdfundme/*` (e.g. `ProposalCard.tsx:48-51`, `GradedFeed.tsx:52-67`) — QA skill recommends showing fiat alongside token amounts. CLAWD price feed may not be trivially available, so acceptable to skip.

- **[INFO]** OG metadata title template still reads "Scaffold-ETH 2" — `packages/nextjs/utils/scaffold-eth/getMetadata.ts:5` — `titleTemplate = "%s | Scaffold-ETH 2"`. Tab title for the home page is fine (uses `default`), but sub-page titles would render "X | Scaffold-ETH 2". Cosmetic; the dApp is single-page so no concrete harm today.

- **[INFO]** No Phantom connector and no mobile deep-linking for wallet hand-off — `packages/nextjs/services/web3/wagmiConnectors.tsx` (not edited) + QA checklist — Default RainbowKit connector list + default flow. Mobile users on non-in-app browsers may have a rougher time; desktop/in-app browser flows are unaffected.

- **[INFO]** Default WalletConnect project ID fallback — `packages/nextjs/scaffold.config.ts:34` — If `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` is unset, the SE2 shared default is used. Fine for testing; production should set its own project ID on Vercel.

- **[INFO]** Test suite covers happy paths, edge cases, and a fuzz invariant (`paid + burned == funded`), but has no explicit reentrancy test — `packages/foundry/test/ClawdFundMe.t.sol` — `nonReentrant` is applied to `fund`, `grade`, and `refund`; CLAWD is a known-good ERC20 so reentrancy is extremely unlikely in practice. Acceptable.

## Summary
- Must Fix: 2 items
- Known Issues: 11 items
- Audit frameworks followed: contract audit (ethskills), QA audit (ethskills)
