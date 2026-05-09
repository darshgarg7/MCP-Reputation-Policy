import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  Route,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { thresholdForRiskTolerance } from "@/lib/rpl-policy";
import type { DemoHealth } from "@/lib/api-client";
import type { AgentGoal, DataSource, TelemetryEvent } from "@/lib/rpl-types";

interface Props {
  goal: AgentGoal;
  sources: DataSource[];
  events: TelemetryEvent[];
  pending: boolean;
  resetPending: boolean;
  health?: DemoHealth;
  healthLoading: boolean;
  onRunPoisonedScenario: () => void;
  onResetDemo: () => void;
}

export function DemoControlPanel({
  goal,
  sources,
  events,
  pending,
  resetPending,
  health,
  healthLoading,
  onRunPoisonedScenario,
  onResetDemo,
}: Props) {
  const latest = events[0] ?? null;
  const chosen = latest ? sources.find((s) => s.source_id === latest.chosen_source_id) : null;
  const decisionScore = latest?.decision_score ?? latest?.prev_reputation ?? chosen?.base_reputation;
  const threshold = latest?.risk_threshold ?? thresholdForRiskTolerance(latest?.goal.risk_tolerance ?? goal.risk_tolerance);
  const passedThreshold = typeof decisionScore === "number" && decisionScore >= threshold;
  const selectedRoute = latest?.chosen_source_id;
  const currentToolType = latest?.tool_type ?? "FINANCIAL_DATA";
  const comparison = buildComparison(sources, currentToolType, chosen, latest);

  return (
    <section className="glass rounded-2xl p-5 sm:p-6 min-h-[430px] flex flex-col">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-success" />
            <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
              Demo Mode
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Reputation poisoning · automatic reroute · live MCP calls
          </p>
        </div>
        <span className="rounded-md border border-success/40 bg-success/10 px-2 py-1 font-mono text-[10px] text-success">
          AWS DEMO
        </span>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <HealthPill
          icon={<Activity className="h-3 w-3" />}
          label="API"
          value={healthLoading ? "CHECK" : health?.apiOk ? "OK" : "DOWN"}
          good={Boolean(health?.apiOk)}
          loading={healthLoading}
        />
        <HealthPill
          icon={<Server className="h-3 w-3" />}
          label="MCP"
          value={healthLoading ? "CHECK" : `${health?.mcpHealthy ?? 0}/${health?.mcpTotal ?? 4}`}
          good={Boolean(health && health.mcpTotal > 0 && health.mcpHealthy === health.mcpTotal)}
          loading={healthLoading}
        />
        <HealthPill
          icon={<Activity className="h-3 w-3" />}
          label="Metrics"
          value={healthLoading ? "CHECK" : health?.metricsOk ? "OK" : "DOWN"}
          good={Boolean(health?.metricsOk)}
          loading={healthLoading}
        />
      </div>

      <div className="rounded-xl border border-success/30 bg-success/5 p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Route className="h-4 w-4 text-success" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-success">
            Current Decision
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground break-words">
          {selectedRoute ? (
            <>
              Routed to <code className="font-mono text-success">{selectedRoute}</code>
            </>
          ) : (
            "Awaiting first route"
          )}
        </div>
        <div className="mt-2 font-mono text-xs text-muted-foreground">
          {latest && typeof decisionScore === "number" ? (
            passedThreshold ? (
              <>
                because score <span className="text-foreground">{decisionScore.toFixed(2)}</span> &gt; threshold{" "}
                <span className="text-foreground">{threshold.toFixed(2)}</span>
              </>
            ) : (
              <>
                highest remaining backup at <span className="text-foreground">{decisionScore.toFixed(2)}</span>; threshold{" "}
                <span className="text-foreground">{threshold.toFixed(2)}</span>
              </>
            )
          ) : (
            <>no route selected yet</>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 mb-4">
        <BeforeAfterCard
          label="Without RPL"
          value={comparison.without}
          tone="danger"
        />
        <BeforeAfterCard
          label="With RPL"
          value={comparison.with}
          tone="success"
        />
      </div>

      {latest && (
        <div className="rounded-xl border border-border bg-surface/50 p-3 mb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Latest Event
            </span>
            <span className={cn("font-mono text-[10px]", latest.outcome === "SUCCESS" ? "text-success" : "text-danger")}>
              {latest.outcome}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
            <span className="truncate">{latest.tool_type ?? chosen?.tool_type ?? "MCP_TOOL"}</span>
            <span className="shrink-0">{latest.latency_sec.toFixed(2)}s · sat {latest.relevance.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="mt-auto grid gap-2 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          onClick={onRunPoisonedScenario}
          disabled={pending || resetPending}
          className={cn(
            "h-11 rounded-lg bg-success text-success-foreground px-4 text-sm font-semibold",
            "inline-flex items-center justify-center gap-2 shadow-[0_0_24px_-8px_oklch(0.84_0.21_148/70%)]",
            "hover:brightness-105 disabled:opacity-50 disabled:shadow-none transition-all",
          )}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Poisoned Tool Scenario
        </button>
        <button
          type="button"
          onClick={onResetDemo}
          disabled={pending || resetPending}
          className="h-11 rounded-lg border border-border bg-surface/70 px-4 text-sm font-semibold text-foreground/85 hover:text-foreground hover:bg-accent/40 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          {resetPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reset Demo State
        </button>
      </div>
    </section>
  );
}

function HealthPill({
  icon,
  label,
  value,
  good,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  good: boolean;
  loading: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 bg-surface/50",
        good ? "border-success/35" : "border-danger/35",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
        {label}
      </div>
      <div className={cn("mt-1 font-mono text-xs font-semibold", good ? "text-success" : "text-danger")}>
        {value}
      </div>
    </div>
  );
}

function BeforeAfterCard({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={cn(
        "rounded-xl border p-3 min-h-[94px]",
        tone === "success" ? "border-success/35 bg-success/5" : "border-danger/35 bg-danger/5",
      )}
    >
      <div className={cn("flex items-center gap-1.5 mb-2 font-mono text-[10px] uppercase tracking-wider", tone === "success" ? "text-success" : "text-danger")}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xs text-foreground/90 leading-relaxed">{value}</p>
    </div>
  );
}

function buildComparison(
  sources: DataSource[],
  toolType: string,
  chosen: DataSource | null,
  latest: TelemetryEvent | null,
) {
  const candidates = sources.filter((s) => s.tool_type === toolType);
  const lowest = candidates.reduce<DataSource | null>(
    (worst, source) => (!worst || source.base_reputation < worst.base_reputation ? source : worst),
    null,
  );
  const staticSource =
    candidates.find((s) => s.source_id === "legacy_mainframe") ??
    lowest ??
    sources.find((s) => s.status !== "TRUSTED") ??
    sources[0] ??
    null;
  const active = chosen ?? candidates[0] ?? sources[0] ?? null;

  if (!latest) {
    return {
      without: staticSource
        ? `bad source used: static priority can pin traffic to ${staticSource.source_id}`
        : "bad source used: static policy has no live trust signal",
      with: "rerouted: waiting for first policy decision",
    };
  }

  const poisoned = latest.demo_event === "POISONED_SOURCE";
  return {
    without: poisoned
      ? `bad source used: static route keeps the poisoned response in path`
      : staticSource
        ? `bad source used: static priority can still choose ${staticSource.source_id}`
        : "bad source used: static policy has no reputation threshold",
    with: active
      ? `rerouted: policy selected ${active.source_id} from live reputation`
      : "rerouted: policy blocks sources below threshold",
  };
}
