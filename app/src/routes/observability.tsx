import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronRight, Activity, Zap } from "lucide-react";
import { AppHeader } from "@/components/rpl/app-header";
import { AppFooter } from "@/components/rpl/app-footer";
import { CloudwatchWidget } from "@/components/rpl/cloudwatch-widget";
import { XrayWaterfall } from "@/components/rpl/xray-waterfall";
import { SloGauge } from "@/components/rpl/slo-gauge";
import { AlarmsList } from "@/components/rpl/alarms-list";
import { BenchmarkCard } from "@/components/rpl/benchmark-card";
import { useTelemetry } from "@/lib/telemetry-store";

export const Route = createFileRoute("/observability")({
  component: ObservabilityPage,
  head: () => ({
    meta: [
      { title: "Observability · RPL on AWS" },
      {
        name: "description",
        content:
          "Production observability for the Reputation Policy Layer — CloudWatch dashboards, X-Ray traces, SLO burn-rate alarms.",
      },
      { property: "og:title", content: "Observability · RPL on AWS" },
      {
        property: "og:description",
        content:
          "CloudWatch + X-Ray view of live RPL routing decisions.",
      },
    ],
  }),
});

function ObservabilityPage() {
  const events = useTelemetry();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 lg:py-8 space-y-5">
        <div>
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Link to="/rpl" className="hover:text-foreground">RPL</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground/80">Observability</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">SRE Console</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            CloudWatch metric views, X-Ray distributed traces, SLO burn-rate alarms — all driven by
            the live telemetry buffer of routing decisions made on this console.
          </p>
        </div>

        {/* CloudWatch dashboard */}
        <section className="glass rounded-2xl p-5 sm:p-6">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-success" />
              <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
                CloudWatch · RPL/Routing
              </h2>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {events.length === 0 ? "no telemetry yet" : `${events.length} datapoints · last 24 buckets`}
            </span>
          </header>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CloudwatchWidget
              title="p95 latency"
              unit="s"
              events={events}
              project={(e) => e.latency_sec}
              aggregate={(b) => {
                const sorted = [...b].sort((a, c) => a - c);
                return sorted[Math.floor(sorted.length * 0.95)] ?? 0;
              }}
              threshold={2}
              format={(n) => n.toFixed(2)}
              tone="primary"
            />
            <CloudwatchWidget
              title="error rate"
              unit="%"
              events={events}
              project={(e) => (e.outcome === "ERROR" ? 1 : 0)}
              aggregate={(b) => (b.length === 0 ? 0 : (b.reduce((a, c) => a + c, 0) / b.length) * 100)}
              threshold={5}
              format={(n) => n.toFixed(1)}
              tone="danger"
            />
            <CloudwatchWidget
              title="decisions / min"
              unit="rpm"
              events={events}
              project={() => 1}
              aggregate={(b) => b.length}
              format={(n) => n.toFixed(0)}
              tone="info"
            />
            <CloudwatchWidget
              title="avg satisfaction"
              unit="rel"
              events={events}
              project={(e) => e.relevance}
              format={(n) => n.toFixed(2)}
              tone="primary"
            />
          </div>
        </section>

        {/* SLO + alarms */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <section className="glass rounded-2xl p-5 sm:p-6 h-full">
              <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-success" />
                  <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
                    Service Level Objectives
                  </h2>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">multi-window burn alerts</span>
              </header>
              <SloGauge events={events} objective={0.999} />
            </section>
          </div>
          <AlarmsList events={events} />
        </div>

        {/* Benchmark artifact */}
        <BenchmarkCard />

        {/* X-Ray waterfall */}
        <section className="glass rounded-2xl p-5 sm:p-6">
          <header className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
              X-Ray · sampled trace
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">sampled 1/100 · last 5m</span>
          </header>
          <XrayWaterfall />
        </section>
      </div>

      <AppFooter />
    </main>
  );
}
