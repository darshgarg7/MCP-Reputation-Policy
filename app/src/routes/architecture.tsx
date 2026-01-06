import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/rpl/app-header";
import { AppFooter } from "@/components/rpl/app-footer";
import {
  ArchitectureDiagram,
  ServicePanel,
} from "@/components/rpl/architecture-diagram";
import { ThreatLegend } from "@/components/rpl/threat-overlay";
import { DeploySection } from "@/components/rpl/deploy-section";
import { AWS_SERVICES, type AwsService, LAYER_LABELS, LAYER_COLORS } from "@/lib/aws-architecture";
import { Activity, ChevronRight, Shield } from "lucide-react";

export const Route = createFileRoute("/architecture")({
  component: ArchitecturePage,
  head: () => ({
    meta: [
      { title: "Architecture · RPL on AWS" },
      {
        name: "description",
        content:
          "Production AWS reference architecture for the Reputation Policy Layer — Bedrock, Strands Agents, ECS Fargate, DynamoDB, Kinesis, CloudWatch.",
      },
      { property: "og:title", content: "Architecture · RPL on AWS" },
      {
        property: "og:description",
        content:
          "Reference architecture for running the Reputation Policy Layer for MCP on AWS at production scale.",
      },
    ],
  }),
});

function ArchitecturePage() {
  const [selected, setSelected] = useState<AwsService | null>(null);
  const [traceTick, setTraceTick] = useState(0);
  const [showThreats, setShowThreats] = useState(false);
  const [healths] = useState(() =>
    AWS_SERVICES.map((s) => ({ id: s.id, name: s.name, status: pickHealth() })),
  );

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" />
      <AppHeader />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 lg:py-8 space-y-5">
        {/* Breadcrumb + title */}
        <div>
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Link to="/rpl" className="hover:text-foreground">RPL</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground/80">Architecture</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            RPL on AWS · Reference Architecture
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Production deployment of the Reputation Policy Layer. Click any service to inspect its
            role, IAM permissions, and the data flowing through it. Hit{" "}
            <span className="font-mono text-foreground/80">Trace a request</span> to watch a live
            agent call traverse the system.
          </p>
        </div>

        {/* Health bar */}
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-success" />
              <h2 className="font-mono text-[10px] uppercase tracking-wider text-foreground/85">
                Service health · us-east-1
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowThreats((s) => !s)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${showThreats ? "border-danger/50 bg-danger/10 text-danger" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"}`}
              >
                <Shield className="h-3 w-3" /> Threat model {showThreats ? "on" : "off"}
              </button>
              <button
                onClick={() => setTraceTick((t) => t + 1)}
                className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/15 transition-colors"
              >
                Trace a request →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {healths.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-surface/40"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    h.status === "healthy" ? "bg-success animate-blink" : h.status === "degraded" ? "bg-warning" : "bg-danger"
                  }`}
                />
                <span className="font-mono text-[10px] text-foreground/85 truncate">{h.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Diagram + side panel */}
        <div className="grid gap-5 lg:grid-cols-12">
          <div className={selected || showThreats ? "lg:col-span-8" : "lg:col-span-12"}>
            <ArchitectureDiagram
              onSelect={setSelected}
              selectedId={selected?.id ?? null}
              traceTick={traceTick}
              showThreats={showThreats}
            />
            <Legend />
          </div>
          {(selected || showThreats) && (
            <div className="lg:col-span-4 space-y-4">
              {selected && <ServicePanel svc={selected} onClose={() => setSelected(null)} />}
              {showThreats && <ThreatLegend />}
            </div>
          )}
        </div>

        <DeploySection />
      </div>

      <AppFooter />
    </main>
  );
}

function Legend() {
  const layers = Object.keys(LAYER_LABELS) as Array<keyof typeof LAYER_LABELS>;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 px-1">
      {layers.map((l) => (
        <div key={l} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: LAYER_COLORS[l] }} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {LAYER_LABELS[l]}
          </span>
        </div>
      ))}
    </div>
  );
}

function pickHealth(): "healthy" | "degraded" | "down" {
  const r = Math.random();
  if (r > 0.95) return "degraded";
  return "healthy";
}
