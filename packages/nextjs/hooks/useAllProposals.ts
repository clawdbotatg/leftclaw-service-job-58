import { useMemo } from "react";
import { useBlockNumber, useReadContracts } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

export type ProposalView = {
  id: bigint;
  proposer: `0x${string}`;
  builder: `0x${string}`;
  description: string;
  fundingGoal: bigint;
  funded: bigint;
  deadline: bigint;
  duration: bigint;
  score: number;
  delivered: boolean;
  settled: boolean;
  status: number; // 0 OPEN, 1 FUNDED, 2 GRADED, 3 SETTLED, 4 CANCELLED
  burnAmount: bigint;
  builderAmount: bigint;
  lateBlocks: bigint;
};

export function useAllProposals(totalCount: number) {
  const { data: deployed } = useDeployedContractInfo({ contractName: "ClawdFundMe" });
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const ids = useMemo(() => Array.from({ length: totalCount }, (_, i) => BigInt(i + 1)), [totalCount]);

  const { data, refetch, isLoading } = useReadContracts({
    contracts: deployed
      ? ids.map(id => ({
          address: deployed.address,
          abi: deployed.abi,
          functionName: "getProposal",
          args: [id],
        }))
      : [],
    query: { enabled: !!deployed && totalCount > 0 },
  });

  useMemo(() => {
    if (blockNumber !== undefined) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumber]);

  const proposals = useMemo<ProposalView[]>(() => {
    if (!data) return [];
    return data
      .map(r => r.result as unknown as ProposalView | undefined)
      .filter((p): p is ProposalView => !!p && p.id > 0n);
  }, [data]);

  return { proposals, isLoading };
}
