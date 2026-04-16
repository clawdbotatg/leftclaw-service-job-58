"use client";

import { useState } from "react";
import { ContributorsList } from "./ContributorsList";
import { FundForm } from "./FundForm";
import { StatusBadge } from "./StatusBadge";
import { formatClawd, formatTimeRemaining, percent } from "./format";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import type { ProposalView } from "~~/hooks/useAllProposals";
import { useClawdToken } from "~~/hooks/useClawdToken";

export const ProposalCard = ({ p }: { p: ProposalView }) => {
  const [expanded, setExpanded] = useState(false);
  const { decimals, symbol } = useClawdToken();
  const { address } = useAccount();
  const { writeContractAsync: writeRefund, isMining: isRefunding } = useScaffoldWriteContract({
    contractName: "ClawdFundMe",
  });

  const pct = percent(p.funded, p.fundingGoal);
  const remaining = p.fundingGoal > p.funded ? p.fundingGoal - p.funded : 0n;

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-5 gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs opacity-60 font-mono">#{p.id.toString()}</span>
              <StatusBadge status={p.status} />
              {p.status === 1 && <span className="text-xs opacity-70">⏳ {formatTimeRemaining(p.deadline)}</span>}
            </div>
            <p className={`text-base-content ${expanded ? "" : "line-clamp-2"}`}>{p.description}</p>
            <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
              <span>by</span>
              <Address address={p.proposer} size="xs" />
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(e => !e)}>
            {expanded ? "Collapse" : "Details"}
          </button>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            {/* Known issue: No USD conversion shown alongside CLAWD amounts; a CLAWD price feed is not readily available. */}
            <span className="font-semibold tabular-nums">
              {formatClawd(p.funded, decimals)} / {formatClawd(p.fundingGoal, decimals)} {symbol}
            </span>
            <span className="opacity-70 tabular-nums">{pct.toFixed(1)}%</span>
          </div>
          <progress className="progress progress-primary w-full" value={pct} max={100}></progress>
        </div>

        {expanded && (
          <div className="flex flex-col gap-4 pt-2">
            {p.status === 0 && <FundForm proposalId={p.id} remaining={remaining} status={p.status} />}

            {p.status === 4 && address && (
              <button
                className="btn btn-warning"
                disabled={isRefunding}
                onClick={async () => {
                  try {
                    await writeRefund({ functionName: "refund", args: [p.id] });
                  } catch {
                    /* handled */
                  }
                }}
              >
                {isRefunding ? <span className="loading loading-spinner loading-sm" /> : null}
                Claim refund
              </button>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2 opacity-80">Contributors</h4>
              <ContributorsList proposalId={p.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
