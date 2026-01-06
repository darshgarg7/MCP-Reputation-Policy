import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TelemetryEvent } from "@/lib/rpl-types";

interface Props {
  events: TelemetryEvent[];
  /** SLO objective, e.g. 0.999 for three-nines availability. */
  objective: number;
}

const FAST_BUDGET_HOURS = 1;
const SLOW_BUDGET_HOURS = 6;

export function SloGauge({ events, objective }: Props) {
  const stats = useMemo(() => {
    if (events.length === 0) {
      return { current: objective, fastBurn: 0, slowBurn: 0, errBudget: 1 };
    }
    const succ = events.filter((e) => e.outcome === "SUCCESS").length;
    const current = succ / events.length;
    const errorRate = 1 - current;
    // Burn rate = (observed error rate) / (1 - objective).
    const burn = errorRate / Math.max(0.0001, 1 - objective);
    return {
      current,
      fastBurn: burn,
      slowBurn: burn * 0.6,
      errBudget: Math.max(0, 1 - burn / 14.4), // 14.4x burn = full month consumed in 2h
    };
  }, [events, objective]);

  const fastBreach = stats.fastBurn > 14.4; // 1h fast-burn threshold
  const slowBreach = stats.slowBurn > 6; // 6h slow-burn threshold

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          SLO · availability
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">target {(objective * 100).toFixed(1)}%</div>
      </div>

      <div className="grid grid-cols-3 gap-3 items-center mb-3">
        <Dial value={stats.current} objective={objective} />
        <BurnCard
          label={`${FAST_BUDGET_HOURS}h fast burn`}
          value={stats.fastBurn}
          threshold={14.4}
          breach={fastBreach}
        />
        <BurnCard
          label={`${SLOW_BUDGET_HOURS}h slow burn`}
          value={stats.slowBurn}
          threshold={6}
          breach={slowBreach}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            error budget remaining
          </span>
          <span className={cn("font-mono text-[10px] tabular-nums", stats.errBudget < 0.2 ? "text-danger" : "text-foreground/85")}>
            {(stats.errBudget * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              stats.errBudget < 0.2 ? "bg-danger" : stats.errBudget < 0.5 ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${Math.max(2, stats.errBudget * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Dial({ value, objective }: { value: number; objective: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const ok = value >= objective;
  return (
    <div className="relative w-20 h-20 mx-auto">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx={40} cy={40} r={r} stroke="oklch(1 0 0 / 8%)" strokeWidth={6} fill="none" />
        <circle
          cx={40}
          cy={40}
          r={r}
          stroke={ok ? "oklch(0.84 0.21 148)" : "oklch(0.66 0.25 22)"}
          strokeWidth={6}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-sm font-semibold tabular-nums", ok ? "text-foreground/95" : "text-danger")}>
          {(value * 100).toFixed(2)}%
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">live</span>
      </div>
    </div>
  );
}

function BurnCard({ label, value, threshold, breach }: { label: string; value: number; threshold: number; breach: boolean }) {
  const pct = Math.min(100, (value / threshold) * 100);
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-base font-semibold tabular-nums", breach ? "text-danger" : "text-foreground/90")}>
        {value.toFixed(1)}×
      </div>
      <div className="h-1 bg-muted/60 rounded-full mt-1.5 overflow-hidden">
        <div className={cn("h-full", breach ? "bg-danger" : "bg-success")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
