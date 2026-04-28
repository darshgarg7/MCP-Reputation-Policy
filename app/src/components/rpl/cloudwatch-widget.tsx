import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TelemetryEvent } from "@/lib/rpl-types";

interface Props {
  title: string;
  unit: string;
  events: TelemetryEvent[];
  /** Function to project an event into a numeric series value. */
  project: (e: TelemetryEvent) => number;
  /** Aggregate the bucket values into a display number. */
  aggregate?: (bucket: number[]) => number;
  threshold?: number;
  format?: (n: number) => string;
  tone?: "primary" | "warning" | "danger" | "info";
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-chart-4",
};
const TONE_FILL: Record<NonNullable<Props["tone"]>, string> = {
  primary: "fill-success",
  warning: "fill-warning",
  danger: "fill-danger",
  info: "fill-chart-4",
};
const TONE_STROKE: Record<NonNullable<Props["tone"]>, string> = {
  primary: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
  info: "stroke-chart-4",
};

const W = 320;
const H = 90;

export function CloudwatchWidget({
  title,
  unit,
  events,
  project,
  aggregate,
  threshold,
  format,
  tone = "primary",
}: Props) {
  const series = useMemo(() => {
    const N = 24; // last 24 buckets
    const buckets: number[][] = Array.from({ length: N }, () => []);
    if (events.length === 0) return Array(N).fill(0);
    const oldest = events[events.length - 1].timestamp;
    const newest = events[0].timestamp;
    const span = Math.max(1, newest - oldest);
    for (const e of events) {
      const idx = Math.min(N - 1, Math.floor(((e.timestamp - oldest) / span) * N));
      buckets[idx].push(project(e));
    }
    return buckets.map((b) => (b.length === 0 ? 0 : aggregate ? aggregate(b) : b.reduce((a, c) => a + c, 0) / b.length));
  }, [events, project, aggregate]);

  const max = Math.max(...series, threshold ?? 0, 0.0001);
  const current = series[series.length - 1] ?? 0;
  const breached = threshold !== undefined && current > threshold;

  const path = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * (W - 8) + 4;
      const y = H - 6 - (v / max) * (H - 18);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = path + ` L ${W - 4} ${H - 6} L 4 ${H - 6} Z`;

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3.5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{title}</div>
          <div className={cn("text-xl font-semibold tabular-nums mt-0.5", breached ? "text-danger" : "text-foreground/95")}>
            {format ? format(current) : current.toFixed(2)}
            <span className="text-[10px] font-normal text-muted-foreground ml-1">{unit}</span>
          </div>
        </div>
        {threshold !== undefined && (
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">SLO</div>
            <div className={cn("font-mono text-[10px] tabular-nums", breached ? "text-danger" : "text-success")}>
              {breached ? "BREACH" : "OK"}
            </div>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block overflow-visible">
        <defs>
          <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.4} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {threshold !== undefined && (
          <line
            x1={4}
            x2={W - 4}
            y1={H - 6 - (threshold / max) * (H - 18)}
            y2={H - 6 - (threshold / max) * (H - 18)}
            stroke="oklch(0.66 0.25 22 / 60%)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}
        <path d={areaPath} className={cn(TONE[tone])} fill={`url(#grad-${title})`} opacity={0.6} />
        <path d={path} className={cn(TONE_STROKE[tone])} fill="none" strokeWidth={1.5} />
        {series.map((v, i) => {
          const x = (i / Math.max(1, series.length - 1)) * (W - 8) + 4;
          const y = H - 6 - (v / max) * (H - 18);
          if (i !== series.length - 1) return null;
          return <circle key={i} cx={x} cy={y} r={2.5} className={cn(TONE_FILL[tone])} />;
        })}
      </svg>
    </div>
  );
}
