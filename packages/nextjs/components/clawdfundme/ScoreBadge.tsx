export const ScoreBadge = ({ score, delivered }: { score: number; delivered: boolean }) => {
  if (!delivered) return <span className="badge badge-ghost badge-lg font-bold">—</span>;
  let cls = "bg-neutral text-neutral-content";
  if (score >= 8) cls = "bg-success text-success-content";
  else if (score >= 5) cls = "bg-warning text-warning-content";
  else if (score >= 1) cls = "bg-error text-error-content";
  return <div className={`rounded-lg px-3 py-1.5 font-bold text-lg tabular-nums ${cls}`}>{score}/10</div>;
};
