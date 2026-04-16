"use client";

import { useMemo } from "react";
import { formatClawd } from "./format";
import { Address } from "@scaffold-ui/components";
import { useReadContracts } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useClawdToken } from "~~/hooks/useClawdToken";

export const ContributorsList = ({ proposalId }: { proposalId: bigint }) => {
  const { decimals, symbol } = useClawdToken();
  const { data: deployed } = useDeployedContractInfo({ contractName: "ClawdFundMe" });
  const { data: contributors } = useScaffoldReadContract({
    contractName: "ClawdFundMe",
    functionName: "getContributors",
    args: [proposalId],
  });

  const addressList = useMemo(() => (contributors as `0x${string}`[] | undefined) ?? [], [contributors]);

  const { data: amounts } = useReadContracts({
    contracts: deployed
      ? addressList.map(addr => ({
          address: deployed.address,
          abi: deployed.abi,
          functionName: "getContribution",
          args: [proposalId, addr],
        }))
      : [],
    query: { enabled: !!deployed && addressList.length > 0 },
  });

  const rows = useMemo(
    () =>
      addressList.map((addr, i) => ({
        addr,
        amount: (amounts?.[i]?.result as bigint | undefined) ?? 0n,
      })),
    [addressList, amounts],
  );

  if (addressList.length === 0) {
    return <p className="text-sm opacity-60 italic">No contributors yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map(r => (
        <div key={r.addr} className="flex justify-between items-center bg-base-200 rounded-lg px-3 py-2">
          <Address address={r.addr} size="sm" />
          <span className="font-semibold tabular-nums">
            {formatClawd(r.amount, decimals)} {symbol}
          </span>
        </div>
      ))}
    </div>
  );
};
