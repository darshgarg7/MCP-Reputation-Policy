import { useMemo } from "react";
import { Database, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { computePolicyScore } from "@/lib/rpl-policy";
import type { AgentGoal, DataSource } from "@/lib/rpl-types";
import { AnimatedNumber } from "@/components/mcp/animated-number";
import { Sparkline } from "./sparkline";
import { REPUTATION_CHART_COLORS } from "./reputation-chart";

interface Props {
  goal: AgentGoal;
  sources: DataSource[];
  selectedIds: string[];
  highlightedSourceId: string | null;
  onToggleVisible: (id: string) => void;
}

function tone(score: number) {
  if (score >= 0.7) return "success";
  if (score >= 0.4) return "warning";
  return "danger";
}

export function SourcesTable({ goal, sources, selectedIds, highlightedSourceId, onToggleVisible }: Props) {
  const rows = useMemo(
    () =>
      sources.map((s, i) => ({
        s,
        policy: computePolicyScore(s, goal.derived_weights),
        color: REPUTATION_CHART_COLORS[i % REPUTATION_CHART_COLORS.length],
      })),
    [sources, goal.derived_weights],
  );

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Trust Fabric · Data Sources
          </h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{sources.length} registered</span>
      </header>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map(({ s, policy, color }) => (
          <MobileRow
            key={s.source_id}
            s={s}
            policy={policy}
            color={color}
            visible={selectedIds.includes(s.source_id)}
            highlighted={s.source_id === highlightedSourceId}
            onToggleVisible={onToggleVisible}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-normal w-6"></th>
              <th className="py-2 pr-3 font-normal">Source</th>
              <th className="py-2 pr-3 font-normal">Base Reputation</th>
              <th className="py-2 pr-3 font-normal">Policy Score</th>
              <th className="py-2 pr-3 font-normal">Status</th>
              <th className="py-2 pr-3 font-normal">Confidence</th>
              <th className="py-2 pr-3 font-normal text-right">Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, policy, color }) => {
              const baseTone = tone(s.base_reputation);
              const policyTone = tone(policy);
              const visible = selectedIds.includes(s.source_id);
              const highlighted = s.source_id === highlightedSourceId;
              return (
                <tr
                  key={s.source_id}
                  className={cn(
                    "border-b border-border/60 transition-colors",
                    highlighted ? "bg-success/5" : "hover:bg-accent/30",
                  )}
                >
                  <td className="py-2.5 pr-3 align-middle">
                    <button
                      onClick={() => onToggleVisible(s.source_id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={visible ? "Hide from chart" : "Show on chart"}
                    >
                      {visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: visible ? color : "oklch(1 0 0 / 20%)" }}
                      />
                      <div className="min-w-0">
                        <code className="font-mono text-xs text-foreground/95 block truncate">
                          {s.source_id}
                        </code>
                        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                          {s.tag}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2">
                      <AnimatedNumber
                        value={s.base_reputation}
                        decimals={4}
                        className={cn(
                          "font-mono text-xs tabular-nums w-14 inline-block",
                          baseTone === "success" && "text-success",
                          baseTone === "warning" && "text-warning",
                          baseTone === "danger" && "text-danger",
                        )}
                      />
                      <Sparkline
                        values={s.history.slice(-20)}
                        color={
                          baseTone === "success"
                            ? "oklch(0.84 0.21 148)"
                            : baseTone === "warning"
                              ? "oklch(0.82 0.17 70)"
                              : "oklch(0.66 0.25 22)"
                        }
                      />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2">
                      <AnimatedNumber
                        value={policy}
                        decimals={4}
                        className={cn(
                          "font-mono text-xs tabular-nums w-14 inline-block",
                          policyTone === "success" && "text-success",
                          policyTone === "warning" && "text-warning",
                          policyTone === "danger" && "text-danger",
                        )}
                      />
                      <div className="h-1 w-20 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            policyTone === "success" && "bg-success",
                            policyTone === "warning" && "bg-warning",
                            policyTone === "danger" && "bg-danger",
                          )}
                          style={{ width: `${policy * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 align-middle">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-foreground/90 w-10 inline-block">
                        {s.confidence.toFixed(2)}
                      </span>
                      <div className="h-1 w-16 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-chart-4 transition-all duration-500"
                          style={{ width: `${s.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 align-middle text-right">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {s.last_latency.toFixed(2)}s
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: DataSource["status"] }) {
  const trusted = status === "TRUSTED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        trusted ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full animate-blink", trusted ? "bg-success" : "bg-danger")} />
      {trusted ? "TRUSTED" : "BROKEN"}
    </span>
  );
}

function MobileRow({
  s,
  policy,
  color,
  visible,
  highlighted,
  onToggleVisible,
}: {
  s: DataSource;
  policy: number;
  color: string;
  visible: boolean;
  highlighted: boolean;
  onToggleVisible: (id: string) => void;
}) {
  const t = tone(policy);
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface/60 p-3 transition-colors",
        highlighted && "bg-success/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: visible ? color : "oklch(1 0 0 / 20%)" }} />
          <code className="font-mono text-xs text-foreground/95 truncate">{s.source_id}</code>
        </div>
        <button onClick={() => onToggleVisible(s.source_id)} className="text-muted-foreground">
          {visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div>
          <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Base</div>
          <div className="text-foreground">{s.base_reputation.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Policy</div>
          <div className={cn(t === "success" && "text-success", t === "warning" && "text-warning", t === "danger" && "text-danger")}>
            {policy.toFixed(4)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Conf</div>
          <div className="text-foreground">{s.confidence.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Latency</div>
          <div className="text-foreground">{s.last_latency.toFixed(2)}s</div>
        </div>
      </div>
      <div className="mt-2">
        <StatusPill status={s.status} />
      </div>
    </div>
  );
}
