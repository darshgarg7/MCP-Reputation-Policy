import { Activity } from "lucide-react";
import type { LogEntry } from "@/lib/mcp-types";
import { LogCard } from "./log-card";

export function TelemetryLog({ logs }: { logs: LogEntry[] }) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6 flex flex-col min-h-[300px]">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Telemetry & Routing Log
          </h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {logs.length} {logs.length === 1 ? "event" : "events"}
        </span>
      </header>

      {logs.length === 0 ? (
        <div className="relative flex-1 flex items-center justify-center rounded-xl border border-dashed border-border bg-surface/30 overflow-hidden min-h-[200px]">
          <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-success/40 to-transparent animate-scanline pointer-events-none" />
          <div className="relative text-center px-6">
            <p className="font-mono text-sm text-muted-foreground">
              No transactions yet.
            </p>
            <p className="font-mono text-xs text-muted-foreground/70 mt-1">
              Execute a task to see the agent route.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 -mr-1">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </section>
  );
}
