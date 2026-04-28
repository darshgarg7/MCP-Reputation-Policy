import { useMemo, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { TRUST_THRESHOLD, type ServerState } from "@/lib/mcp-types";
import { ServerCard } from "./server-card";
import { AnimatedNumber } from "./animated-number";

interface Props {
  servers: ServerState[];
  lastUpdatedServerId: string | null;
}

export function ReputationGrid({ servers, lastUpdatedServerId }: Props) {
  // Track previous scores to determine pulse direction.
  const prevScoresRef = useRef<Record<string, number>>({});
  const pulseMap = useMemo(() => {
    const map: Record<string, "up" | "down" | null> = {};
    for (const s of servers) {
      const prev = prevScoresRef.current[s.server_id];
      if (lastUpdatedServerId === s.server_id && prev != null && prev !== s.score) {
        map[s.server_id] = s.score >= prev ? "up" : "down";
      } else {
        map[s.server_id] = null;
      }
      prevScoresRef.current[s.server_id] = s.score;
    }
    return map;
  }, [servers, lastUpdatedServerId]);

  const stats = useMemo(() => {
    const total = servers.length;
    const trusted = servers.filter((s) => s.status === "TRUSTED").length;
    const blocked = total - trusted;
    const avg = total === 0 ? 0 : servers.reduce((a, s) => a + s.score, 0) / total;
    return { total, trusted, blocked, avg };
  }, [servers]);

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Live Reputation Audit
          </h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          threshold ≥ {TRUST_THRESHOLD.toFixed(2)}
        </span>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Stat label="Servers" value={stats.total} />
        <Stat label="Trusted" value={stats.trusted} tone="success" />
        <Stat label="Blocked" value={stats.blocked} tone="danger" />
        <Stat label="Avg Score" value={stats.avg} decimals={4} />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {servers.map((s) => (
          <ServerCard key={s.server_id} server={s} pulse={pulseMap[s.server_id]} />
        ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  decimals = 0,
  tone,
}: {
  label: string;
  value: number;
  decimals?: number;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-lg bg-surface/60 border border-border px-3 py-2.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <AnimatedNumber
        value={value}
        decimals={decimals}
        duration={500}
        className={
          "block font-mono text-xl mt-0.5 tabular-nums " +
          (tone === "success"
            ? "text-success"
            : tone === "danger"
              ? "text-danger"
              : "text-foreground")
        }
      />
    </div>
  );
}
