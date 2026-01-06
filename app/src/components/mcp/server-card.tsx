import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TRUST_THRESHOLD, type ServerState } from "@/lib/mcp-types";
import { TOOL_LABELS, ToolTypeIcon } from "./tool-type-icon";
import { AnimatedNumber } from "./animated-number";

interface Props {
  server: ServerState;
  pulse: "up" | "down" | null;
}

function scoreColor(score: number) {
  if (score >= TRUST_THRESHOLD) return "success";
  if (score >= 0.4) return "warning";
  return "danger";
}

export function ServerCard({ server, pulse }: Props) {
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (pulse) setPulseKey((k) => k + 1);
  }, [pulse]);

  const tone = scoreColor(server.score);
  const trusted = server.status === "TRUSTED";
  const pct = Math.max(0, Math.min(1, server.score)) * 100;

  return (
    <article
      key={pulseKey + server.server_id}
      className={cn(
        "glass rounded-xl p-4 transition-all duration-300 relative",
        pulse === "up" && "pulse-success",
        pulse === "down" && "pulse-danger",
      )}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <code className="font-mono text-sm text-foreground/95 block truncate">
            {server.server_id}
          </code>
          <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
            <ToolTypeIcon type={server.tool_type} size={11} />
            <span className="text-[10px] font-mono tracking-wide uppercase">
              {TOOL_LABELS[server.tool_type]}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase shrink-0",
            trusted ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full animate-blink",
              trusted ? "bg-success" : "bg-danger",
            )}
          />
          {server.status}
        </span>
      </header>

      {/* Score */}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Reputation
        </span>
        <AnimatedNumber
          value={server.score}
          decimals={4}
          className={cn(
            "font-mono text-lg tabular-nums",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-danger",
          )}
        />
      </div>

      {/* Bar */}
      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-700 ease-out rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-danger",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>
          interactions:{" "}
          <AnimatedNumber
            value={server.interactions}
            decimals={0}
            duration={400}
            className="text-foreground/80"
          />
        </span>
        <span>threshold: {TRUST_THRESHOLD.toFixed(2)}</span>
      </div>
    </article>
  );
}
