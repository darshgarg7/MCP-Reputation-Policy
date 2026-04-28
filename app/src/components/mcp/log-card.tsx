import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/lib/mcp-types";
import { TOOL_LABELS, ToolTypeIcon } from "./tool-type-icon";

function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function LogCard({ log }: { log: LogEntry }) {
  const success = log.outcome_status === "SUCCESS";
  const [, force] = useState(0);

  // Re-render every 15s to refresh relative timestamps.
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const scoreDelta = log.new_score - log.prev_score;
  const deltaUp = scoreDelta >= 0;

  return (
    <article
      className={cn(
        "animate-log-in glass rounded-xl p-4 border-l-2 relative overflow-hidden",
        success ? "border-l-success" : "border-l-danger",
      )}
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ToolTypeIcon
            type={log.tool_type}
            size={14}
            className="text-muted-foreground shrink-0"
          />
          <code className="font-mono text-sm text-foreground/95 truncate">
            {log.server_id}
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
              success
                ? "bg-success/15 text-success"
                : "bg-danger/15 text-danger",
            )}
          >
            {success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {log.outcome_status}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {relativeTime(log.timestamp)}
          </span>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Metric label="LATENCY" value={`${log.latency_sec.toFixed(2)}s`} />
        <Metric label="COST" value={`$${log.compute_cost.toFixed(4)}`} />
        <Metric
          label="SAT"
          value={log.client_satisfaction.toFixed(2)}
          bar={log.client_satisfaction}
        />
      </div>

      {/* Result */}
      <p className="font-mono text-xs text-muted-foreground leading-relaxed line-clamp-2 group-hover:line-clamp-none">
        <span className="text-foreground/40 mr-1">›</span>
        {log.result}
      </p>

      {/* Score delta footer */}
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground truncate">
          via <span className="text-foreground/70">{TOOL_LABELS[log.tool_type]}</span> · "
          <span className="text-foreground/70">{log.prompt.slice(0, 40)}{log.prompt.length > 40 ? "…" : ""}</span>"
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 shrink-0",
            deltaUp ? "text-success" : "text-danger",
          )}
        >
          {deltaUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          {Math.abs(scoreDelta).toFixed(4)}
        </span>
      </div>
    </article>
  );
}

function Metric({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="rounded-md bg-surface/60 border border-border px-2.5 py-1.5">
      <div className="text-[9px] text-muted-foreground font-mono tracking-wider">{label}</div>
      <div className="font-mono text-xs text-foreground mt-0.5">{value}</div>
      {bar != null && (
        <div className="mt-1 h-0.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-success transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
