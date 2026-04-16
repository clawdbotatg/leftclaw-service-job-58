"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useClawdToken } from "~~/hooks/useClawdToken";
import { notification } from "~~/utils/scaffold-eth";

const DURATIONS: { label: string; seconds: number }[] = [
  { label: "1 week", seconds: 7 * 24 * 3600 },
  { label: "2 weeks", seconds: 14 * 24 * 3600 },
  { label: "1 month", seconds: 30 * 24 * 3600 },
];

export const SubmitProposal = () => {
  const { address } = useAccount();
  const { decimals, symbol } = useClawdToken();

  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [durationIdx, setDurationIdx] = useState(0);

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "ClawdFundMe" });

  const parsedGoal = (() => {
    try {
      if (!goal) return 0n;
      return parseUnits(goal, decimals);
    } catch {
      return 0n;
    }
  })();

  const descOk = description.trim().length > 0;
  const goalOk = parsedGoal > 0n;
  const canSubmit = !!address && descOk && goalOk && !isMining;

  const onSubmit = async () => {
    try {
      await writeContractAsync({
        functionName: "propose",
        args: [description.trim(), parsedGoal, BigInt(DURATIONS[durationIdx].seconds)],
      });
      setDescription("");
      setGoal("");
      notification.success("Proposal submitted");
    } catch {
      // transactor surfaces error
    }
  };

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm max-w-2xl mx-auto">
      <div className="card-body p-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Submit a Proposal</h2>
          <p className="opacity-70 text-sm mt-1">
            Describe what you will build, set a funding goal in {symbol}, and pick a delivery window. Once the goal is
            hit the clock starts; deliver, then the owner grades your work.
          </p>
        </div>

        <label className="form-control">
          <div className="label">
            <span className="label-text font-semibold">Description</span>
          </div>
          <textarea
            className="textarea textarea-bordered min-h-[140px]"
            placeholder="What are you building and why does it matter?"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </label>

        <label className="form-control">
          <div className="label">
            <span className="label-text font-semibold">Funding goal ({symbol})</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            className="input input-bordered"
            placeholder="e.g. 1000"
            value={goal}
            onChange={e => setGoal(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </label>

        <div className="form-control">
          <div className="label">
            <span className="label-text font-semibold">Delivery window</span>
          </div>
          <div className="join">
            {DURATIONS.map((d, i) => (
              <button
                key={d.label}
                type="button"
                className={`btn join-item ${durationIdx === i ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setDurationIdx(i)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {!address && (
          <div className="alert alert-warning text-sm py-2">
            <span>Connect your wallet to submit.</span>
          </div>
        )}

        <button className="btn btn-primary" disabled={!canSubmit} onClick={onSubmit}>
          {isMining ? <span className="loading loading-spinner loading-sm" /> : null}
          Submit proposal
        </button>
      </div>
    </div>
  );
};
