import type { ReactNode } from "react";

export function KpiCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-muted/40 border rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-semibold text-foreground mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
