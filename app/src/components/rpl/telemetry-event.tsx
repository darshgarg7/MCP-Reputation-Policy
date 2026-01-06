import { ArrowDown, ArrowUp, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TelemetryEvent } from "@/lib/rpl-types";
import { formulaLabel } from "@/lib/rpl-policy";
import { regionFor, REGION_COLORS } from "@/lib/region";
import { useTenant } from "@/lib/tenant-store";

function relTime(ts: number) {
  const d = Math.max(0, Date.now() - ts);
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

export function TelemetryEventCard({ event }: { event: TelemetryEvent }) {
  const success = event.outcome === "SUCCESS";
  const delta = event.new_reputation - event.prev_reputation;
  const up = delta >= 0;
  const tenant = useTenant();
  return (
    <article
      className={cn(
        "animate-log-in glass rounded-lg p-3 border-l-2",
        success ? "border-l-success" : "border-l-danger",
      )}
    >
      <header className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider shrink-0"
            style={{ color: tenant.color, backgroundColor: `${tenant.color}1F` }}
            title={`Tenant — IAM PrincipalTag/tenant=${tenant.id}`}
          >
            {tenant.id.split("-")[0]}
          </span>
          <code className="font-mono text-xs text-foreground/95 truncate">{event.chosen_source_id}</code>
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider shrink-0"
            style={{
              color: REGION_COLORS[regionFor(event.chosen_source_id)],
              backgroundColor: `${REGION_COLORS[regionFor(event.chosen_source_id)]}22`,
            }}
            title="Simulated AWS region (deterministic from source_id)"
          >
            {regionFor(event.chosen_source_id)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              success ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
            )}
          >
            {success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {event.outcome}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground shrink-0">{relTime(event.timestamp)}</span>
      </header>

      <div className="rounded-md bg-surface/60 border border-border px-2 py-1 mb-2">
        <span className="font-mono text-[10px] text-muted-foreground">policy = </span>
        <span className="font-mono text-[10px] text-foreground/90">{formulaLabel(event.goal.derived_weights)}</span>
        <span className="font-mono text-[10px] text-muted-foreground"> = </span>
        <span className="font-mono text-[10px] text-success">{event.policy_score.toFixed(4)}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="LAT" value={`${event.latency_sec.toFixed(2)}s`} />
        <Mini label="REL" value={event.relevance.toFixed(2)} />
        <Mini
          label="Δ REP"
          value={(up ? "+" : "−") + Math.abs(delta).toFixed(4)}
          tone={up ? "success" : "danger"}
          icon={up ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
        />
      </div>

      <div className="mt-2 font-mono text-[10px] text-muted-foreground truncate">
        goal: <span className="text-foreground/70">{event.goal.goal_type}</span> · risk{" "}
        <span className="text-foreground/70">{event.goal.risk_tolerance}</span>
      </div>
    </article>
  );
}

function Mini({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-surface/60 border border-border px-2 py-1">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-xs flex items-center gap-1",
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground",
        )}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
