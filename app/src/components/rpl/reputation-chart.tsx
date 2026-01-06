import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineIcon } from "lucide-react";
import type { DataSource } from "@/lib/rpl-types";

const COLORS = [
  "oklch(0.84 0.21 148)",
  "oklch(0.72 0.16 220)",
  "oklch(0.82 0.17 70)",
  "oklch(0.75 0.18 300)",
  "oklch(0.66 0.25 22)",
];

interface Props {
  sources: DataSource[];
  selectedIds: string[];
}

export function ReputationChart({ sources, selectedIds }: Props) {
  const visible = sources.filter((s) => selectedIds.includes(s.source_id));

  const data = useMemo(() => {
    const len = Math.max(0, ...visible.map((s) => s.history.length));
    const offset = visible[0]?.history.length ?? len;
    return Array.from({ length: len }, (_, i) => {
      const row: Record<string, number | string> = { t: `t-${offset - i - 1}` };
      for (const s of visible) {
        // Right-align histories of differing lengths.
        const idx = i - (len - s.history.length);
        if (idx >= 0 && idx < s.history.length) {
          row[s.source_id] = s.history[idx];
        }
      }
      return row;
    });
  }, [visible]);

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LineIcon className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Reputation over Time
          </h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          baseline 0.50 · decay 1.5%/tick · tick = 2s
        </span>
      </header>

      <div className="h-[300px] w-full">
        {visible.length === 0 ? (
          <div className="h-full grid place-items-center text-muted-foreground font-mono text-xs">
            Select at least one source from the table below.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <defs>
                {visible.map((s, i) => (
                  <linearGradient key={s.source_id} id={`grad-${s.source_id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="oklch(1 0 0 / 6%)" />
              <XAxis
                dataKey="t"
                tick={{ fill: "oklch(0.70 0.025 250)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "oklch(1 0 0 / 8%)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: "oklch(0.70 0.025 250)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "oklch(1 0 0 / 8%)" }}
                tickLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.18 0.02 250 / 95%)",
                  border: "1px solid oklch(1 0 0 / 10%)",
                  borderRadius: 8,
                  fontFamily: "JetBrains Mono",
                  fontSize: 11,
                }}
                labelStyle={{ color: "oklch(0.70 0.025 250)" }}
                formatter={(v: number) => v.toFixed(4)}
              />
              <Legend
                wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10, paddingTop: 4 }}
                iconType="plainline"
              />
              {visible.map((s, i) => (
                <Area
                  key={s.source_id}
                  type="monotone"
                  dataKey={s.source_id}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={1.8}
                  fill={`url(#grad-${s.source_id})`}
                  isAnimationActive
                  animationDuration={400}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export const REPUTATION_CHART_COLORS = COLORS;
