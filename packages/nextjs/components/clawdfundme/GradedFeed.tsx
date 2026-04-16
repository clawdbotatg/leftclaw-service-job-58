"use client";

import { useMemo } from "react";
import { ScoreBadge } from "./ScoreBadge";
import { formatClawd } from "./format";
import { Address } from "@scaffold-ui/components";
import { useAllProposals } from "~~/hooks/useAllProposals";
import { useClawdToken } from "~~/hooks/useClawdToken";

export const GradedFeed = ({ totalCount }: { totalCount: number }) => {
  const { proposals, isLoading } = useAllProposals(totalCount);
  const { decimals, symbol } = useClawdToken();

  const graded = useMemo(() => proposals.filter(p => p.status === 3), [proposals]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  if (graded.length === 0) {
    return (
      <div className="text-center py-20 opacity-70">
        <p className="text-lg">No graded proposals yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {graded.map(p => {
        const lateDays = Number(p.lateBlocks / 7200n);
        return (
          <div key={p.id.toString()} className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs opacity-60 font-mono">#{p.id.toString()}</span>
                  </div>
                  <p className="font-medium mb-3">{p.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="opacity-60">Builder:</span>
                      <Address address={p.builder} size="xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="opacity-60">Funded:</span>
                      <span className="font-semibold tabular-nums">
                        {formatClawd(p.funded, decimals)} {symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="opacity-60">Burned:</span>
                      <span className="font-semibold tabular-nums text-error">
                        {formatClawd(p.burnAmount, decimals)} {symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="opacity-60">Paid out:</span>
                      <span className="font-semibold tabular-nums text-success">
                        {formatClawd(p.builderAmount, decimals)} {symbol}
                      </span>
                    </div>
                    {lateDays > 0 && (
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <span className="opacity-60">Late penalty:</span>
                        <span className="font-semibold text-warning">
                          {lateDays} day{lateDays === 1 ? "" : "s"} late
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <ScoreBadge score={p.score} delivered={p.delivered} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
