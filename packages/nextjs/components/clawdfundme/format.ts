import { formatUnits } from "viem";

export function formatClawd(amount: bigint | undefined, decimals = 18, maxFrac = 2): string {
  if (amount === undefined) return "0";
  const raw = Number(formatUnits(amount, decimals));
  if (raw === 0) return "0";
  if (raw < 0.01) return "<0.01";
  return raw.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export function formatTimeRemaining(deadline: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(deadline) - now;
  if (diff <= 0) return "deadline passed";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function percent(num: bigint, den: bigint): number {
  if (den === 0n) return 0;
  // Multiply by 10000 then divide for two-decimal precision without floats on huge bigints
  const p = Number((num * 10_000n) / den) / 100;
  return Math.min(100, p);
}
