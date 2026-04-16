"use client";

import { useMemo } from "react";
import { ProposalCard } from "./ProposalCard";
import { percent } from "./format";
import { useAllProposals } from "~~/hooks/useAllProposals";

export const ProposalFeed = ({ totalCount }: { totalCount: number }) => {
  const { proposals, isLoading } = useAllProposals(totalCount);

  const active = useMemo(() => {
    return proposals
      .filter(p => p.status === 0 || p.status === 1)
      .sort((a, b) => percent(b.funded, b.fundingGoal) - percent(a.funded, a.fundingGoal));
  }, [proposals]);

  if (totalCount === 0) {
    return <EmptyState text="No proposals yet. Be the first to submit one." />;
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  if (active.length === 0) {
    return <EmptyState text="No active proposals right now." />;
  }

  return (
    <div className="grid gap-4">
      {active.map(p => (
        <ProposalCard key={p.id.toString()} p={p} />
      ))}
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-20 opacity-70">
    <p className="text-lg">{text}</p>
  </div>
);
