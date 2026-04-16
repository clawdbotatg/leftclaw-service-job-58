"use client";

import { useMemo, useState } from "react";
import type { NextPage } from "next";
import { GradedFeed } from "~~/components/clawdfundme/GradedFeed";
import { Leaderboard } from "~~/components/clawdfundme/Leaderboard";
import { ProposalFeed } from "~~/components/clawdfundme/ProposalFeed";
import { SubmitProposal } from "~~/components/clawdfundme/SubmitProposal";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

type Tab = "active" | "graded" | "leaderboard" | "submit";

const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Active Proposals" },
  { key: "graded", label: "Graded" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "submit", label: "Submit Proposal" },
];

const Home: NextPage = () => {
  const [tab, setTab] = useState<Tab>("active");

  const { data: proposalCount } = useScaffoldReadContract({
    contractName: "ClawdFundMe",
    functionName: "proposalCount",
  });

  const count = useMemo(() => (proposalCount ? Number(proposalCount) : 0), [proposalCount]);

  return (
    <div className="flex flex-col grow w-full">
      <section className="bg-base-200 border-b border-base-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-primary">ClawdFundMe</h1>
              <p className="mt-2 text-base sm:text-lg text-base-content/70 max-w-2xl">
                Crowdfund project proposals in $CLAWD. Builder ships, AI grades 1–10, contract burns a
                quality-proportional cut and releases the rest.
              </p>
            </div>
            <div className="stats stats-horizontal bg-base-100 shadow-sm border border-base-300 shrink-0">
              <div className="stat py-3 px-4">
                <div className="stat-title text-xs">Proposals</div>
                <div className="stat-value text-2xl">{count}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pt-6">
        <div role="tablist" className="tabs tabs-boxed bg-base-200">
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              onClick={() => setTab(t.key)}
              className={`tab ${tab === t.key ? "tab-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 grow">
        {tab === "active" && <ProposalFeed totalCount={count} />}
        {tab === "graded" && <GradedFeed totalCount={count} />}
        {tab === "leaderboard" && <Leaderboard totalCount={count} />}
        {tab === "submit" && <SubmitProposal />}
      </div>
    </div>
  );
};

export default Home;
