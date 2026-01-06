import { Radio } from "lucide-react";
import type { AgentGoal, DataSource, TelemetryEvent } from "@/lib/rpl-types";
import { RoutingGraph } from "./routing-graph";
import { TelemetryEventCard } from "./telemetry-event";

interface Props {
  goal: AgentGoal;
  sources: DataSource[];
  events: TelemetryEvent[];
  pending: boolean;
  highlightedSourceId: string | null;
}

export function TelemetryFeed({ goal, sources, events, pending, highlightedSourceId }: Props) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6 flex flex-col">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Dynamic Routing & Telemetry
          </h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{events.length} events</span>
      </header>

      <div className="rounded-xl border border-border bg-surface/40 overflow-hidden mb-3">
        <RoutingGraph
          goal={goal}
          sources={sources}
          highlightedSourceId={highlightedSourceId}
          pending={pending}
        />
      </div>

      {events.length === 0 ? (
        <div className="flex-1 min-h-[160px] grid place-items-center rounded-lg border border-dashed border-border bg-surface/30 px-4 text-center">
          <div>
            <p className="font-mono text-sm text-muted-foreground">Awaiting first request.</p>
            <p className="font-mono text-xs text-muted-foreground/70 mt-1">
              Configure a goal and execute to see routing telemetry.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 -mr-1">
          {events.map((e) => (
            <TelemetryEventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}
