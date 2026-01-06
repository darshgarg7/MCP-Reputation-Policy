import { useMemo } from "react";
import { Bell, CheckCircle2, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TelemetryEvent } from "@/lib/rpl-types";

interface AlarmDef {
  name: string;
  metric: string;
  threshold: string;
  evaluate: (events: TelemetryEvent[]) => "OK" | "ALARM" | "INSUFFICIENT";
}

const ALARMS: AlarmDef[] = [
  {
    name: "RPL-Routing-ErrorRate-High",
    metric: "errorRate(5m) > 5%",
    threshold: "0.05",
    evaluate: (events) => {
      if (events.length < 5) return "INSUFFICIENT";
      const errs = events.filter((e) => e.outcome === "ERROR").length / events.length;
      return errs > 0.05 ? "ALARM" : "OK";
    },
  },
  {
    name: "RPL-Latency-p95-High",
    metric: "p95(latency_sec) > 2s",
    threshold: "2.0",
    evaluate: (events) => {
      if (events.length < 5) return "INSUFFICIENT";
      const sorted = events.map((e) => e.latency_sec).sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      return p95 > 2 ? "ALARM" : "OK";
    },
  },
  {
    name: "RPL-Reputation-Quarantine-Spike",
    metric: "Δreputation < -0.4 in window",
    threshold: "-0.4",
    evaluate: (events) => {
      if (events.length < 5) return "INSUFFICIENT";
      const drops = events.filter((e) => e.new_reputation - e.prev_reputation < -0.4).length;
      return drops >= 2 ? "ALARM" : "OK";
    },
  },
];

export function AlarmsList({ events }: { events: TelemetryEvent[] }) {
  const rows = useMemo(
    () => ALARMS.map((a) => ({ ...a, state: a.evaluate(events) })),
    [events],
  );

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-warning" />
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-foreground/85">
            CloudWatch alarms
          </h3>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{rows.length} configured</span>
      </div>
      <ul className="space-y-2">
        {rows.map((a) => (
          <li
            key={a.name}
            className={cn(
              "rounded-lg border p-3 flex items-start gap-3",
              a.state === "ALARM"
                ? "border-danger/50 bg-danger/5"
                : a.state === "OK"
                ? "border-border bg-background/40"
                : "border-border bg-background/40 opacity-70",
            )}
          >
            {a.state === "ALARM" ? (
              <AlertOctagon className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2
                className={cn("h-4 w-4 mt-0.5 shrink-0", a.state === "OK" ? "text-success" : "text-muted-foreground")}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-foreground/95 truncate">{a.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground truncate">{a.metric}</div>
            </div>
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                a.state === "ALARM"
                  ? "border-danger/50 text-danger bg-danger/10"
                  : a.state === "OK"
                  ? "border-success/40 text-success bg-success/10"
                  : "border-border text-muted-foreground",
              )}
            >
              {a.state === "INSUFFICIENT" ? "no-data" : a.state.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
