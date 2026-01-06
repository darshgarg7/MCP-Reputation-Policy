import { useState } from "react";
import { Gauge, Download, X, Copy, Check, GitBranch, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LATEST_BENCHMARK,
  benchmarkAgeDays,
  freshnessFor,
  hoursUntilNextRun,
  type RouterBenchmark,
  type Freshness,
} from "@/lib/benchmark-results";
import { K6_SCRIPT, K6_SCRIPT_FILENAME } from "@/lib/benchmark-script";

export function BenchmarkCard() {
  const [showScript, setShowScript] = useState(false);
  const b = LATEST_BENCHMARK;
  const rpl = b.routers.find((r) => r.router === "RPL")!;
  const baseline = b.routers.find((r) => r.router === "Round-Robin")!;

  const errorReduction = (1 - rpl.error_rate_pct / baseline.error_rate_pct) * 100;
  const p99Reduction = (1 - rpl.p99_ms / baseline.p99_ms) * 100;

  const ageDays = benchmarkAgeDays(b.date);
  const freshness = freshnessFor(ageDays);
  const hoursToNext = hoursUntilNextRun(b.ci.next_run_at);

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Gauge className="h-4 w-4 text-success shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
                Load test artifact
              </h2>
              <FreshnessPill freshness={freshness} ageDays={ageDays} />
              <a
                href={b.ci.workflow_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider bg-chart-4/15 text-chart-4 hover:bg-chart-4/25 transition-colors"
                title="View nightly CI workflow on GitHub"
              >
                <GitBranch className="h-2.5 w-2.5" />
                {b.ci.schedule}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {b.date} · {b.tool} · {b.target_rps.toLocaleString()} RPS · {b.duration_min}m · {b.vus} VUs ·
              commit <span className="text-foreground/70">{b.ci.commit_sha}</span> · next run in{" "}
              <span className="text-foreground/70">{hoursToNext}h</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={b.ci.run_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 hover:bg-accent px-2.5 py-1.5 text-[11px] font-mono text-foreground/85 transition-colors"
            title="Open the latest CI run on GitHub Actions"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh from CI
          </a>
          <button
            onClick={() => setShowScript(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 hover:bg-accent px-2.5 py-1.5 text-[11px] font-mono text-foreground/85 transition-colors"
          >
            <Download className="h-3 w-3" />
            k6 script
          </button>
        </div>
      </header>

      {/* Headline metric tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Tile label="p50" value={`${rpl.p50_ms}ms`} sub="RPL routing decision" />
        <Tile label="p95" value={`${rpl.p95_ms}ms`} sub="end-to-end" />
        <Tile label="p99" value={`${rpl.p99_ms}ms`} sub="end-to-end" tone="primary" />
        <Tile label="Decision overhead" value={`${rpl.overhead_ms.toFixed(1)}ms`} sub="vs raw forward" tone="success" />
      </div>

      {/* p99 sparkline */}
      <div className="rounded-lg border border-border bg-surface/40 p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            p99 latency over test window
          </span>
          <span className="font-mono text-[10px] text-foreground/70">
            min {Math.min(...b.p99_series_ms)}ms · max {Math.max(...b.p99_series_ms)}ms
          </span>
        </div>
        <Sparkline data={b.p99_series_ms} />
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-[11px]">
          <thead className="bg-surface/60">
            <tr className="text-left">
              <Th>Router</Th>
              <Th align="right">p50</Th>
              <Th align="right">p95</Th>
              <Th align="right">p99</Th>
              <Th align="right">Errors</Th>
              <Th align="right">Throughput</Th>
            </tr>
          </thead>
          <tbody>
            {b.routers.map((r) => (
              <Row key={r.router} r={r} highlight={r.router === "RPL"} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="success">−{p99Reduction.toFixed(0)}% p99 vs Round-Robin</Badge>
        <Badge tone="success">−{errorReduction.toFixed(0)}% errors vs Round-Robin</Badge>
        <Badge tone="primary">+{(((rpl.throughput_rps / baseline.throughput_rps) - 1) * 100).toFixed(1)}% throughput</Badge>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">{b.notes}</p>

      {showScript && <ScriptModal onClose={() => setShowScript(false)} />}
    </section>
  );
}

function FreshnessPill({ freshness, ageDays }: { freshness: Freshness; ageDays: number }) {
  const label =
    ageDays === 0 ? "today" : ageDays === 1 ? "1d ago" : `${ageDays}d ago`;
  const cls =
    freshness === "fresh"
      ? "bg-success/15 text-success border-success/30"
      : freshness === "stale"
      ? "bg-warning/15 text-warning border-warning/30"
      : "bg-danger/15 text-danger border-danger/30";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider border",
        cls,
      )}
      title={`Last CI run ${ageDays} day(s) ago — ${freshness}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-blink" />
      {freshness} · {label}
    </span>
  );
}

function Tile({ label, value, sub, tone = "muted" }: { label: string; value: string; sub: string; tone?: "muted" | "primary" | "success" }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-xl tabular-nums mt-0.5",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "muted" && "text-foreground/95",
        )}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "font-mono text-[9px] uppercase tracking-wider text-muted-foreground px-3 py-2",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Row({ r, highlight }: { r: RouterBenchmark; highlight: boolean }) {
  return (
    <tr
      className={cn(
        "border-t border-border",
        highlight ? "bg-success/5" : "hover:bg-accent/30",
      )}
    >
      <td className="px-3 py-2">
        <span className={cn("font-mono", highlight ? "text-success font-semibold" : "text-foreground/85")}>
          {r.router}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground/85">{r.p50_ms}ms</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground/85">{r.p95_ms}ms</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground/85">{r.p99_ms}ms</td>
      <td
        className={cn(
          "px-3 py-2 text-right font-mono tabular-nums",
          r.error_rate_pct > 1 ? "text-danger" : "text-foreground/85",
        )}
      >
        {r.error_rate_pct.toFixed(2)}%
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground/85">
        {r.throughput_rps.toLocaleString()}/s
      </td>
    </tr>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "success" | "primary" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tone === "success" && "bg-success/15 text-success",
        tone === "primary" && "bg-primary/15 text-primary",
      )}
    >
      {children}
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const W = 600;
  const H = 60;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? W / (data.length - 1) : W;
  const points = data
    .map((v, i) => `${i * stepX},${H - ((v - min) / span) * (H - 8) - 4}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block">
      <polyline
        points={points}
        fill="none"
        stroke="oklch(0.84 0.21 148)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon
        points={`0,${H} ${points} ${W},${H}`}
        fill="oklch(0.84 0.21 148 / 12%)"
      />
    </svg>
  );
}

function ScriptModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(K6_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function download() {
    const blob = new Blob([K6_SCRIPT], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = K6_SCRIPT_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-5 max-w-3xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Reproducible k6 script</h3>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {K6_SCRIPT_FILENAME} · BASE_URL env var sets the target
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 hover:bg-accent px-2 py-1.5 text-[11px] font-mono text-foreground/85"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "copied" : "copy"}
            </button>
            <button
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 hover:bg-accent px-2 py-1.5 text-[11px] font-mono text-foreground/85"
            >
              <Download className="h-3 w-3" />
              download
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-7 w-7 rounded-md border border-border bg-surface/60 grid place-items-center text-foreground/80 hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
        <pre className="text-[10px] font-mono leading-relaxed text-foreground/85 bg-background/60 border border-border rounded-lg p-3 overflow-auto flex-1">
          {K6_SCRIPT}
        </pre>
      </div>
    </div>
  );
}
