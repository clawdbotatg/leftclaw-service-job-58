# Audit Report — Cycle 2

## MUST FIX

- [ ] **[CRITICAL]** targetNetworks still `[chains.foundry]` only — `packages/nextjs/scaffold.config.ts:18` — Unfixed from Cycle 1. After deploy to Base the dApp is completely unusable: every user is shown a "Wrong Network / Switch to Foundry" prompt and all contract reads/writes against the production contract fail. Must change to `[chains.base]` (keep `chains.foundry` for local if desired).

- [ ] **[HIGH]** No wrong-network guard in primary CTA — `packages/nextjs/components/clawdfundme/FundForm.tsx`, `SubmitProposal.tsx` — Neither component checks `useChainId()`. When the user is on the wrong chain the Fund and Submit buttons remain active; the call goes to the wrong chain and the user receives a cryptic RPC error instead of a clear Switch Network prompt. Fix: add `useChainId() === targetNetwork.id` check and replace the primary button with a `useSwitchChain()`-driven "Switch to Base" button in the same CTA slot when mismatched. SE2's header `WrongNetworkDropdown` alone is not sufficient per the QA framework.

- [ ] **[HIGH]** Approve button re-enables during tx-hash → confirmation window — `packages/nextjs/components/clawdfundme/FundForm.tsx:28,134` — `disabled` reads only `isApproving` (`isPending` from raw wagmi `useWriteContract`), which resolves when the wallet returns a tx hash, not when the transaction confirms. During that window the button re-enables and a second approval can be submitted. Two states are required per the QA framework: (1) `approvalSubmitting` set at the top of the handler and cleared in `finally{}` (covers click→hash gap); (2) `approveCooldown` set after `await` resolves and cleared after 4 s + `refetchAllowance()` (covers hash→cache-refresh gap). The `disabled` prop must read `isApproving || approvalSubmitting || approveCooldown`.

## KNOWN ISSUES

- **[LOW]** SE2 README not replaced — `README.md` — Still the unmodified Scaffold-ETH 2 template README with SE2 branding and docs links. Replace with project-specific content describing ClawdFundMe.

- **[INFO]** "Connect wallet" rendered as alert text in action slot — `packages/nextjs/components/clawdfundme/FundForm.tsx:118-122`, `SubmitProposal.tsx:108-112` — QA framework prefers the CTA button to morph into a `<RainbowKitCustomConnectButton/>`. Here a disabled button plus an inline alert appear while the header's Connect button is the primary entry point. Functional, not a blocker.

- **[INFO]** No USD values alongside CLAWD token amounts — `packages/nextjs/components/clawdfundme/ProposalCard.tsx:49-51`, `GradedFeed.tsx:52-67` — QA framework recommends fiat values next to every token amount. A CLAWD price feed is not readily available; acceptable to skip.

- **[INFO]** ClawdFundMe contract address not displayed with `<Address/>` — `packages/nextjs/app/page.tsx` — Proposer and builder addresses are shown correctly throughout, but the deployed contract address itself is never surfaced. QA framework recommends displaying it (e.g. in a footer or info panel) using the `<Address/>` component.

- **[INFO]** OG image URL resolves to `localhost:3000` in IPFS deploys — `packages/nextjs/utils/scaffold-eth/getMetadata.ts:3-5` — `baseUrl` is derived from `VERCEL_PROJECT_PRODUCTION_URL`. When deployed to IPFS where that env var is absent the image becomes `http://localhost:3000/thumbnail.jpg` and link unfurling breaks. Fine for Vercel; requires an absolute URL or the env var set for IPFS distribution.

- **[INFO]** SE2 titleTemplate remaining — `packages/nextjs/utils/scaffold-eth/getMetadata.ts:7` — `titleTemplate = "%s | Scaffold-ETH 2"`. Home-page default title is correct ("ClawdFundMe") but any sub-page would render "X | Scaffold-ETH 2". Single-page app today, no active harm.

- **[INFO]** Default Alchemy API key fallback — `packages/nextjs/scaffold.config.ts:22` — Falls back to the SE2 shared default key when `NEXT_PUBLIC_ALCHEMY_API_KEY` is unset. Set a dedicated key in the Vercel environment config before production launch.

- **[INFO]** No Phantom wallet connector; no mobile deep-linking — `packages/nextjs/services/web3/wagmiConnectors.tsx` — Acknowledged in code comment. Mobile users on non-in-app browsers may have a degraded WalletConnect handoff. Desktop and in-app browser flows are unaffected.

- **[INFO]** Default WalletConnect project ID fallback — `packages/nextjs/scaffold.config.ts:34` — Falls back to the SE2 shared default if `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` is unset. Set a dedicated ID on Vercel for production.

- **[LOW]** `ProposalStatus.GRADED` enum value is unreachable — `packages/foundry/contracts/ClawdFundMe.sol:16-22` — `grade()` transitions directly FUNDED→SETTLED; `GRADED` is never written. Dead code, harmless, but could confuse future integrators reading the ABI. (Carried from Cycle 1.)

- **[LOW]** Contributor funds locked until owner cancels — `packages/foundry/contracts/ClawdFundMe.sol:221-229` — If a proposal stalls indefinitely and the owner is unresponsive, contributor CLAWD is locked with no on-chain escape hatch. Per-spec for an owner-trusted crowdfund; acceptable, but the UI should surface this risk to funders. (Carried from Cycle 1.)

- **[LOW]** `BLOCKS_PER_DAY = 7200` does not match Base's actual block time — `packages/foundry/contracts/ClawdFundMe.sol:62` — Base produces ~1 block per 2 s; 7 200 blocks ≈ 4 hours, not 1 day. `lateBlocks` is owner-supplied so the owner must normalise manually. No fund-safety risk on the trusted-owner path, but the constant is misleading. (Carried from Cycle 1.)

- **[LOW]** `activeProposals()` / `allProposals()` are O(proposalCount) — `packages/foundry/contracts/ClawdFundMe.sol:261-285` — Full-sweep loops over every proposal. Fine for tens-to-hundreds of proposals; could exceed eth_call gas limits at large scale. (Carried from Cycle 1.)

- **[INFO]** No explicit reentrancy exercise in test suite — `packages/foundry/test/ClawdFundMe.t.sol` — `nonReentrant` guards on `fund`, `grade`, and `refund` are not exercised via a malicious ERC20 callback. CLAWD is a standard OZ ERC20; reentrancy is extremely unlikely. Acceptable. (Carried from Cycle 1.)

## What was fixed since Cycle 1

- **[RESOLVED]** `packages/foundry/foundry.toml` — Base mainnet RPC now uses the Alchemy endpoint with `${ALCHEMY_API_KEY}`. (Cycle 1 MUST FIX #2.)

## Summary
- Must Fix: 3 items
- Known Issues: 14 items
- Audit frameworks followed: contract audit (ethskills), QA audit (ethskills)
