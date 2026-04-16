import { useMemo } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

/**
 * Resolves the CLAWD token address: in local dev we read the `clawd()` getter
 * on ClawdFundMe (which points at MockCLAWD). The same path works on Base,
 * where it returns the real CLAWD.
 */
export function useClawdToken() {
  const { data: clawdFundMe } = useDeployedContractInfo({ contractName: "ClawdFundMe" });
  const { data: tokenAddress } = useScaffoldReadContract({
    contractName: "ClawdFundMe",
    functionName: "clawd",
  });

  const { address: user } = useAccount();

  const { data: meta } = useReadContracts({
    contracts: tokenAddress
      ? [
          { address: tokenAddress, abi: erc20Abi, functionName: "symbol" },
          { address: tokenAddress, abi: erc20Abi, functionName: "decimals" },
        ]
      : [],
    query: { enabled: !!tokenAddress },
  });

  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!tokenAddress && !!user },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: user && clawdFundMe ? [user, clawdFundMe.address] : undefined,
    query: { enabled: !!tokenAddress && !!user && !!clawdFundMe },
  });

  return useMemo(
    () => ({
      tokenAddress,
      spender: clawdFundMe?.address,
      symbol: (meta?.[0]?.result as string | undefined) ?? "CLAWD",
      decimals: (meta?.[1]?.result as number | undefined) ?? 18,
      balance: (balance as bigint | undefined) ?? 0n,
      allowance: (allowance as bigint | undefined) ?? 0n,
      refetchAllowance,
    }),
    [tokenAddress, clawdFundMe?.address, meta, balance, allowance, refetchAllowance],
  );
}
