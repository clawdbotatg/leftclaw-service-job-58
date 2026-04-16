"use client";

import { useMemo } from "react";
import { formatClawd } from "./format";
import { Address } from "@scaffold-ui/components";
import { useReadContracts } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { type ProposalView, useAllProposals } from "~~/hooks/useAllProposals";
import { useClawdToken } from "~~/hooks/useClawdToken";

export const Leaderboard = ({ totalCount }: { totalCount: number }) => {
  const { proposals, isLoading } = useAllProposals(totalCount);
  const { decimals, symbol } = useClawdToken();
  const { data: deployed } = useDeployedContractInfo({ contractName: "ClawdFundMe" });

  // Builder earnings: sum builderAmount per builder for SETTLED proposals.
  const topBuilders = useMemo(() => {
    const map = new Map<string, bigint>();
    proposals
      .filter(p => p.status === 3)
      .forEach(p => {
        map.set(p.builder, (map.get(p.builder) ?? 0n) + p.builderAmount);
      });
    return [...map.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)).slice(0, 10);
  }, [proposals]);

  // Top funders: fetch contributors per proposal, then per-contributor contributions.
  const contributorCallsByProposal = useMemo(
    () =>
      deployed
        ? proposals.map(p => ({
            address: deployed.address,
            abi: deployed.abi,
            functionName: "getContributors",
            args: [p.id],
          }))
        : [],
    [deployed, proposals],
  );
  const { data: contributorsPerProp } = useReadContracts({
    contracts: contributorCallsByProposal,
    query: { enabled: !!deployed && proposals.length > 0 },
  });

  const contributionPairs = useMemo<{ id: bigint; addr: `0x${string}` }[]>(() => {
    if (!contributorsPerProp) return [];
    const pairs: { id: bigint; addr: `0x${string}` }[] = [];
    proposals.forEach((p: ProposalView, i: number) => {
      const addrs = (contributorsPerProp[i]?.result as `0x${string}`[] | undefined) ?? [];
      addrs.forEach(addr => pairs.push({ id: p.id, addr }));
    });
    return pairs;
  }, [proposals, contributorsPerProp]);

  const { data: contributionAmounts } = useReadContracts({
    contracts: deployed
      ? contributionPairs.map(pair => ({
          address: deployed.address,
          abi: deployed.abi,
          functionName: "getContribution",
          args: [pair.id, pair.addr],
        }))
      : [],
    query: { enabled: !!deployed && contributionPairs.length > 0 },
  });

  const topFunders = useMemo(() => {
    const map = new Map<string, bigint>();
    contributionPairs.forEach((pair, i) => {
      const amt = (contributionAmounts?.[i]?.result as bigint | undefined) ?? 0n;
      map.set(pair.addr, (map.get(pair.addr) ?? 0n) + amt);
    });
    return [...map.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)).slice(0, 10);
  }, [contributionPairs, contributionAmounts]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Table
        title="Top Builders"
        subtitle="CLAWD earned from graded proposals"
        rows={topBuilders}
        symbol={symbol}
        decimals={decimals}
      />
      <Table
        title="Top Funders"
        subtitle="CLAWD committed across all proposals"
        rows={topFunders}
        symbol={symbol}
        decimals={decimals}
      />
    </div>
  );
};

const Table = ({
  title,
  subtitle,
  rows,
  symbol,
  decimals,
}: {
  title: string;
  subtitle: string;
  rows: [string, bigint][];
  symbol: string;
  decimals: number;
}) => (
  <div className="card bg-base-100 border border-base-300 shadow-sm">
    <div className="card-body p-5">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-xs opacity-60">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm opacity-60 italic mt-2">No data yet.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-3">
          {rows.map(([addr, amount], i) => (
            <div key={addr} className="flex justify-between items-center bg-base-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm opacity-60 w-6">{i + 1}.</span>
                <Address address={addr as `0x${string}`} size="sm" />
              </div>
              <span className="font-semibold tabular-nums">
                {formatClawd(amount, decimals)} {symbol}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
