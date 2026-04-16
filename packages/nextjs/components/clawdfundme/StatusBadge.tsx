const LABELS: Record<number, { text: string; cls: string }> = {
  0: { text: "Open", cls: "badge-primary" },
  1: { text: "Funded", cls: "badge-accent" },
  2: { text: "Graded", cls: "badge-info" },
  3: { text: "Settled", cls: "badge-success" },
  4: { text: "Cancelled", cls: "badge-error" },
};

export const StatusBadge = ({ status }: { status: number }) => {
  const l = LABELS[status] ?? LABELS[0];
  return <span className={`badge ${l.cls} badge-sm`}>{l.text}</span>;
};
