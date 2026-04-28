import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useRplStore } from "@/hooks/use-rpl-store";
import { GoalConfig } from "@/components/rpl/goal-config";
import { TelemetryFeed } from "@/components/rpl/telemetry-feed";
import { ReputationChart } from "@/components/rpl/reputation-chart";
import { SourcesTable } from "@/components/rpl/sources-table";
import { ComparisonPanel } from "@/components/rpl/comparison-panel";
import { CostCalculator } from "@/components/rpl/cost-calculator";
import { AppHeader } from "@/components/rpl/app-header";
import { AppFooter } from "@/components/rpl/app-footer";
import { CommandPalette } from "@/components/rpl/command-palette";
import { ScenarioRunner } from "@/components/rpl/scenario-runner";
import { Skeleton } from "@/components/ui/skeleton";
import { getScenario } from "@/lib/scenarios";

interface RplSearch {
  run?: string;
}

export const Route = createFileRoute("/rpl")({
  component: RplPage,
  validateSearch: (s: Record<string, unknown>): RplSearch => ({
    run: typeof s.run === "string" ? s.run : undefined,
  }),
  head: () => ({
    meta: [
      { title: "RPL · Reputation Policy Layer for MCP" },
      {
        name: "description",
        content:
          "Configure agent goals, observe dynamic policy routing, and audit the trust fabric of MCP data sources backed by a live Python service.",
      },
      { property: "og:title", content: "RPL · Reputation Policy Layer for MCP" },
      {
        property: "og:description",
        content:
          "Premium AI infrastructure dashboard for the Reputation Policy Layer of the Model Context Protocol.",
      },
    ],
  }),
});

function RplPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const {
    goal,
    setGoal,
    sources,
    isLoadingSources,
    sourcesError,
    refetchSources,
    events,
    pending,
    highlightedSourceId,
    selectedSourceIds,
    setGoalField,
    resetGoal,
    toggleChartSource,
    executeRequest,
    clearTelemetry,
    lastTransactionId,
  } = useRplStore();

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(search.run ?? null);
  const activeScenario = activeScenarioId ? getScenario(activeScenarioId) ?? null : null;

  // Sync URL ?run= with active scenario.
  useEffect(() => {
    if (search.run && search.run !== activeScenarioId) {
      setActiveScenarioId(search.run);
    }
  }, [search.run, activeScenarioId]);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    if (!document.getElementById("mcp-fonts")) {
      const link = document.createElement("link");
      link.id = "mcp-fonts";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // Surface fetch errors as toasts (once per error message).
  useEffect(() => {
    if (sourcesError) {
      toast.error("Backend unreachable", {
        description: sourcesError.message,
        id: "servers-error",
      });
    } else {
      toast.dismiss("servers-error");
    }
  }, [sourcesError]);

  async function onExecute() {
    const res = await executeRequest();
    if (!res.ok && res.reason) toast.error(res.reason);
    else if (res.ok && res.response) {
      toast.success(`Routed → ${res.response.server_id}`, {
        description: `${res.response.outcome_status} · ${res.response.latency_sec.toFixed(2)}s · sat=${res.response.client_satisfaction.toFixed(2)}`,
      });
    }
  }

  function startScenario(id: string) {
    setActiveScenarioId(id);
    navigate({ to: "/rpl", search: { run: id } as never });
  }

  function stopScenario() {
    setActiveScenarioId(null);
    navigate({ to: "/rpl", search: {} as never });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" />
      <AppHeader apiHealthy={!sourcesError} liveLabel={isLoadingSources ? "SYNC" : "LIVE"} />

      {activeScenario && (
        <ScenarioRunner
          scenario={activeScenario}
          setGoal={setGoal}
          executeRequest={(opts) => executeRequest(opts)}
          onClose={stopScenario}
        />
      )}

      <CommandPalette
        lastTransactionId={lastTransactionId}
        onClearTelemetry={clearTelemetry}
        onRunScenario={startScenario}
      />

      <div
        className={`mx-auto max-w-[1600px] px-4 sm:px-6 py-6 lg:py-8 space-y-5 ${activeScenario ? "pt-24" : ""}`}
      >
        {sourcesError && (
          <div className="glass rounded-2xl p-4 border-danger/40 bg-danger/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">Cannot reach the RPL backend</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
                  {sourcesError.message}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Verify the FastAPI service is running and{" "}
                  <code className="font-mono text-foreground/80">VITE_API_BASE_URL</code> is set correctly.
                </div>
              </div>
              <button
                onClick={refetchSources}
                className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/15 transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5 xl:col-span-4">
            <GoalConfig
              goal={goal}
              pending={pending}
              onChangeField={setGoalField}
              onReset={resetGoal}
              onExecute={onExecute}
            />
          </div>
          <div className="lg:col-span-7 xl:col-span-8">
            {isLoadingSources && sources.length === 0 ? (
              <SkeletonPanel label="Telemetry · awaiting backend" />
            ) : (
              <TelemetryFeed
                goal={goal}
                sources={sources}
                events={events}
                pending={pending}
                highlightedSourceId={highlightedSourceId}
              />
            )}
          </div>
        </div>

        <ComparisonPanel events={events} />
        <CostCalculator events={events} />

        {isLoadingSources && sources.length === 0 ? (
          <SkeletonPanel label="Reputation chart · loading" tall />
        ) : (
          <ReputationChart sources={sources} selectedIds={selectedSourceIds} />
        )}

        {isLoadingSources && sources.length === 0 ? (
          <SkeletonPanel label="Trust fabric · loading" />
        ) : (
          <SourcesTable
            goal={goal}
            sources={sources}
            selectedIds={selectedSourceIds}
            highlightedSourceId={highlightedSourceId}
            onToggleVisible={toggleChartSource}
          />
        )}
      </div>

      <AppFooter />
    </main>
  );
}

function SkeletonPanel({ label, tall = false }: { label: string; tall?: boolean }) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="space-y-3">
        <Skeleton className={`w-full ${tall ? "h-64" : "h-16"}`} />
        {!tall && <Skeleton className="w-3/4 h-4" />}
        {!tall && <Skeleton className="w-1/2 h-4" />}
      </div>
    </section>
  );
}
