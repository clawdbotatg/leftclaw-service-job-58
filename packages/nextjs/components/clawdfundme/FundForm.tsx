"use client";

import { useState } from "react";
import { formatClawd } from "./format";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useChainId, useSwitchChain, useWriteContract } from "wagmi";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
  useTransactor,
} from "~~/hooks/scaffold-eth";
import { useClawdToken } from "~~/hooks/useClawdToken";
import { notification } from "~~/utils/scaffold-eth";

type Props = {
  proposalId: bigint;
  remaining: bigint;
  status: number;
};

export const FundForm = ({ proposalId, remaining, status }: Props) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain } = useSwitchChain();
  const { tokenAddress, spender, symbol, decimals, balance, allowance, refetchAllowance } = useClawdToken();
  const [amount, setAmount] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approveCooldown, setApproveCooldown] = useState(false);

  const { data: myContribution } = useScaffoldReadContract({
    contractName: "ClawdFundMe",
    functionName: "getContribution",
    args: address ? [proposalId, address] : [proposalId, "0x0000000000000000000000000000000000000000"],
  });

  const { writeContractAsync: writeApprove, isPending: isApproving } = useWriteContract();
  const writeTx = useTransactor();
  const { writeContractAsync: writeFund, isMining: isFunding } = useScaffoldWriteContract({
    contractName: "ClawdFundMe",
  });

  if (status !== 0) {
    return (
      <div className="alert alert-info">
        <span>Funding is closed for this proposal.</span>
      </div>
    );
  }

  const parsedAmount = (() => {
    try {
      if (!amount) return 0n;
      return parseUnits(amount, decimals);
    } catch {
      return 0n;
    }
  })();

  const clampedAmount = parsedAmount > remaining ? remaining : parsedAmount;

  const needsApproval = clampedAmount > 0n && allowance < clampedAmount;
  const hasBalance = clampedAmount > 0n && balance >= clampedAmount;
  const canFund = !!address && clampedAmount > 0n && !needsApproval && hasBalance;

  const onApprove = async () => {
    if (!tokenAddress || !spender || clampedAmount === 0n) return;
    setApprovalSubmitting(true);
    try {
      await writeTx(() =>
        writeApprove({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, clampedAmount],
        }),
      );
      setApproveCooldown(true);
      await refetchAllowance();
      setTimeout(() => setApproveCooldown(false), 4000);
    } catch {
      // surfaced by transactor
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const onFund = async () => {
    if (clampedAmount === 0n) return;
    try {
      await writeFund({ functionName: "fund", args: [proposalId, clampedAmount] });
      setAmount("");
      await refetchAllowance();
      notification.success("Contribution sent");
    } catch {
      // transactor surfaces error
    }
  };

  return (
    <div className="card bg-base-200 border border-base-300">
      <div className="card-body p-4 gap-3">
        <div className="flex justify-between items-center text-sm">
          <span className="opacity-70">
            Your contribution:{" "}
            <span className="font-semibold">{formatClawd(myContribution as bigint | undefined, decimals)}</span>{" "}
            {symbol}
          </span>
          <span className="opacity-70">
            Balance: <span className="font-semibold">{formatClawd(balance, decimals)}</span> {symbol}
          </span>
        </div>

        <div className="join w-full">
          <input
            type="text"
            inputMode="decimal"
            placeholder={`Amount in ${symbol}`}
            className="input input-bordered join-item w-full"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <button
            type="button"
            className="btn btn-ghost join-item"
            onClick={() => setAmount(formatClawd(remaining, decimals, 6).replace(/,/g, ""))}
          >
            Max
          </button>
        </div>

        {/* Known issue: Disconnected state shows a warning alert rather than a ConnectButton; the header's connect button is the primary wallet entry point. */}
        {!address && (
          <div className="alert alert-warning text-sm py-2">
            <span>Connect your wallet to fund this proposal.</span>
          </div>
        )}

        {clampedAmount > 0n && !hasBalance && (
          <div className="alert alert-error text-sm py-2">
            <span>Not enough {symbol} in your wallet.</span>
          </div>
        )}

        <div className="flex gap-2">
          {address && chainId !== targetNetwork.id ? (
            <button className="btn btn-warning flex-1" onClick={() => switchChain?.({ chainId: targetNetwork.id })}>
              Switch to {targetNetwork.name}
            </button>
          ) : needsApproval ? (
            <button
              className="btn btn-primary flex-1"
              disabled={!hasBalance || isApproving || approvalSubmitting || approveCooldown}
              onClick={onApprove}
            >
              {isApproving || approvalSubmitting ? <span className="loading loading-spinner loading-sm" /> : null}
              Approve {formatClawd(clampedAmount, decimals)} {symbol}
            </button>
          ) : (
            <button className="btn btn-primary flex-1" disabled={!canFund || isFunding} onClick={onFund}>
              {isFunding ? <span className="loading loading-spinner loading-sm" /> : null}
              Fund
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
