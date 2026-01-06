import type { DerivedWeights } from "@/lib/rpl-types";
import { cn } from "@/lib/utils";

const SEGMENTS: { key: keyof DerivedWeights; label: string; color: string; symbol: string }[] = [
  { key: "alpha_rep", label: "Reputation", color: "bg-success", symbol: "α" },
  { key: "beta_acc", label: "Accuracy", color: "bg-chart-4", symbol: "β" },
  { key: "gamma_lat", label: "Latency", color: "bg-warning", symbol: "γ" },
];

export function WeightBars({ weights }: { weights: DerivedWeights }) {
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60">
        {SEGMENTS.map((seg) => (
          <div
            key={seg.key}
            className={cn(seg.color, "h-full transition-all duration-500 ease-out")}
            style={{ width: `${weights[seg.key] * 100}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SEGMENTS.map((seg) => (
          <div
            key={seg.key}
            className="rounded-md border border-border bg-surface/60 px-2 py-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {seg.symbol} {seg.label}
              </span>
              <span className="font-mono text-xs text-foreground tabular-nums">
                {weights[seg.key].toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
