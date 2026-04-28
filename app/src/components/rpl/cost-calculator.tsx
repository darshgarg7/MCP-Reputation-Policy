import { useMemo, useState } from "react";
import { ChevronDown, DollarSign, TrendingDown, Activity, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BEDROCK_MODELS,
  PRICING_AS_OF,
  computeCost,
  computeUnitEconomics,
  fmtUsd,
} from "@/lib/aws-pricing";
import type { TelemetryEvent } from "@/lib/rpl-types";

interface Props {
  events: TelemetryEvent[];
}

const SECONDS_PER_MONTH = 60 * 60 * 24 * 30;
/** Treat events from the last hour as "live"; falls back to whole buffer if sparse. */
const LIVE_WINDOW_MS = 60 * 60 * 1000;

export function CostCalculator({ events }: Props) {
  const [open, setOpen] = useState(true);
  const [rps, setRps] = useState(50);
  const [inputTokens, setInputTokens] = useState(1200);
  const [outputTokens, setOutputTokens] = useState(400);
  const [modelId, setModelId] = useState(BEDROCK_MODELS[0].id);
  const [revenuePerSuccess, setRevenuePerSuccess] = useState(0.05);

  // Live avoided-retry rate from telemetry.
  const avoidedRetryRate = useMemo(() => {
    if (events.length < 3) return 0.18;
    const succ = events.filter((e) => e.outcome === "SUCCESS").length / events.length;
    return Math.max(0.05, Math.min(0.4, succ - Math.max(0.55, succ - 0.18)));
  }, [events]);

  // Live observed RPS from the telemetry ring buffer.
  const live = useMemo(() => {
    if (events.length < 2) return null;
    const now = Date.now();
    const recent = events.filter((e) => now - e.timestamp <= LIVE_WINDOW_MS);
    const sample = recent.length >= 5 ? recent : events.slice(-Math.min(events.length, 60));
    if (sample.length < 2) return null;
    const span = (sample[sample.length - 1].timestamp - sample[0].timestamp) / 1000;
    if (span <= 0) return null;
    const observedRps = Math.max(0.1, sample.length / span);
    const successRate = sample.filter((e) => e.outcome === "SUCCESS").length / sample.length;
    return { observedRps, successRate, sampleSize: sample.length, windowSec: span };
  }, [events]);

  const cost = useMemo(
    () => computeCost({ rps, inputTokens, outputTokens, modelId, avoidedRetryRate }),
    [rps, inputTokens, outputTokens, modelId, avoidedRetryRate],
  );

  // Live cost: same per-request math but driven by observed RPS.
  const liveCost = useMemo(() => {
    if (!live) return null;
    return computeCost({
      rps: live.observedRps,
      inputTokens,
      outputTokens,
      modelId,
      avoidedRetryRate,
    });
  }, [live, inputTokens, outputTokens, modelId, avoidedRetryRate]);

  // Unit economics drive the FinOps tile — uses projection by default,
  // live numbers when telemetry is healthy.
  const econ = useMemo(() => {
    const monthlyCost = liveCost?.perMonth ?? cost.perMonth;
    const monthlySavings = liveCost?.monthlySavings ?? cost.monthlySavings;
    const effectiveRps = live?.observedRps ?? rps;
    const successRate = live?.successRate ?? 0.92;
    return computeUnitEconomics({
      monthlyCost,
      monthlySavings,
      monthlyRequests: effectiveRps * SECONDS_PER_MONTH,
      successRate,
      avoidedRetryRate,
      revenuePerSuccess,
    });
  }, [liveCost, cost, live, rps, avoidedRetryRate, revenuePerSuccess]);

  return (
    <section className="glass rounded-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 sm:p-6"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Projected spend
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
            · live · {PRICING_AS_OF}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-foreground/80 tabular-nums hidden sm:inline">
            {fmtUsd(cost.perMonth)}/mo
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-5">
          {/* Live · last hour — observed from telemetry ring buffer */}
          <div
            className={cn(
              "rounded-xl border p-3.5",
              live ? "border-success/40 bg-success/5" : "border-border bg-surface/40",
            )}
          >
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className={cn("h-3.5 w-3.5", live ? "text-success animate-pulse" : "text-muted-foreground")} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Live · last hour · observed from telemetry
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {live
                  ? `${live.sampleSize} events · ${Math.round(live.windowSec)}s window`
                  : "waiting for ≥5 events…"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <LiveTile
                label="Observed RPS"
                value={live ? live.observedRps.toFixed(1) : "—"}
                sub={live ? `vs ${rps} projected` : "no data yet"}
              />
              <LiveTile
                label="Success rate"
                value={live ? `${(live.successRate * 100).toFixed(1)}%` : "—"}
                sub="last hour"
              />
              <LiveTile
                label="If sustained · /hour"
                value={liveCost ? fmtUsd(liveCost.perMonth / (30 * 24)) : "—"}
                sub="extrapolated"
                tone="primary"
              />
              <LiveTile
                label="If sustained · /month"
                value={liveCost ? fmtUsd(liveCost.perMonth) : "—"}
                sub={liveCost ? `saves ${fmtUsd(liveCost.monthlySavings)}/mo` : "—"}
                tone="success"
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">

          <div className="space-y-4">
            <Slider
              label="Requests per second"
              value={rps}
              min={1}
              max={10000}
              log
              display={`${rps.toLocaleString()} rps`}
              onChange={setRps}
            />
            <Slider
              label="Avg input tokens"
              value={inputTokens}
              min={100}
              max={8000}
              step={50}
              display={`${inputTokens.toLocaleString()} tok`}
              onChange={setInputTokens}
            />
            <Slider
              label="Avg output tokens"
              value={outputTokens}
              min={50}
              max={2000}
              step={25}
              display={`${outputTokens.toLocaleString()} tok`}
              onChange={setOutputTokens}
            />
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                Bedrock model
              </label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-surface/60 px-2.5 text-xs font-mono text-foreground/90 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {BEDROCK_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · ${m.inputPer1K}/1K in · ${m.outputPer1K}/1K out
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Outputs */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-surface/40 p-3.5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cost breakdown · per request
                </span>
                <span className="font-mono text-[11px] text-foreground/85 tabular-nums">
                  {fmtUsd(cost.totalPerRequest)}
                </span>
              </div>
              <CostBar label="Bedrock tokens" value={cost.bedrock} total={cost.totalPerRequest} tone="violet" />
              <CostBar label="DynamoDB" value={cost.dynamodb} total={cost.totalPerRequest} tone="amber" />
              <CostBar label="Kinesis" value={cost.kinesis} total={cost.totalPerRequest} tone="info" />
              <CostBar label="Fargate share" value={cost.fargate} total={cost.totalPerRequest} tone="success" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Projected /month" value={fmtUsd(cost.perMonth)} tone="foreground" />
              <Stat
                label="Round-Robin /month"
                value={fmtUsd(cost.perMonthRoundRobin)}
                tone="muted"
              />
            </div>

            <div className="rounded-xl border border-success/40 bg-success/5 p-3.5 flex items-start gap-3">
              <TrendingDown className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground/95">
                  RPL saves {fmtUsd(cost.monthlySavings)}/mo
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Avoided-retry rate{" "}
                  <span className="font-mono text-foreground/80">
                    {(avoidedRetryRate * 100).toFixed(0)}%
                  </span>{" "}
                  derived from{" "}
                  <span className="font-mono text-foreground/80">{events.length}</span> live decisions.
                </div>
              </div>
            </div>

            <p className="text-[10px] font-mono text-muted-foreground/80">
              Pricing as of {PRICING_AS_OF}. Excludes data transfer, NAT, and Cognito MAU.
            </p>
          </div>
          </div>

          {/* FinOps · unit economics — the language CFOs use */}
          <div className="rounded-xl border border-border bg-surface/40 p-3.5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5 text-chart-4" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  FinOps · unit economics {live ? "· live" : "· projected"}
                </span>
              </div>
              <label className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                Revenue / success
                <input
                  type="number"
                  step={0.005}
                  min={0}
                  value={revenuePerSuccess}
                  onChange={(e) => setRevenuePerSuccess(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 h-6 rounded border border-border bg-background/60 px-1.5 text-[10px] font-mono text-foreground/90 tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                />
                USD
              </label>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <EconTile label="Cost / successful decision" value={fmtUsd(econ.costPerSuccess)} sub="all-in COGS, per success" />
              <EconTile label="Cost / avoided incident" value={fmtUsd(econ.costPerAvoidedIncident)} sub="vs RR baseline" tone="success" />
              <EconTile label="Blended COGS" value={`${econ.blendedCogsPct.toFixed(1)}%`} sub={`of ${fmtUsd(econ.monthlyRevenue)} revenue`} tone={econ.blendedCogsPct > 30 ? "warning" : "muted"} />
              <EconTile label="Gross margin" value={`${econ.grossMarginPct.toFixed(1)}%`} sub="contribution from RPL" tone={econ.grossMarginPct >= 70 ? "success" : econ.grossMarginPct >= 40 ? "muted" : "warning"} />
            </div>
            <p className="mt-2 text-[10px] font-mono text-muted-foreground/80">
              Assumes ~250 requests per averted incident · adjust revenue/success above to model your unit price.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  log = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  log?: boolean;
  onChange: (v: number) => void;
}) {
  // Log-scale slider works on a 0..1000 internal range.
  const toSlider = (v: number) => {
    if (!log) return v;
    return Math.round(((Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))) * 1000);
  };
  const fromSlider = (s: number) => {
    if (!log) return s;
    return Math.round(Math.exp(Math.log(min) + (s / 1000) * (Math.log(max) - Math.log(min))));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className="font-mono text-[11px] tabular-nums text-foreground/85">{display}</span>
      </div>
      <input
        type="range"
        min={log ? 0 : min}
        max={log ? 1000 : max}
        step={step ?? 1}
        value={toSlider(value)}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
        className="w-full accent-success cursor-pointer"
      />
    </div>
  );
}

function CostBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "violet" | "amber" | "info" | "success";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const cls =
    tone === "violet"
      ? "bg-chart-5"
      : tone === "amber"
      ? "bg-warning"
      : tone === "info"
      ? "bg-chart-4"
      : "bg-success";
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-foreground/80">
          {fmtUsd(value)} · {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-500", cls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "foreground" | "muted" }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === "foreground" ? "text-foreground/95" : "text-muted-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function LiveTile({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "muted" | "primary" | "success";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-base tabular-nums mt-0.5",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "muted" && "text-foreground/95",
        )}
      >
        {value}
      </div>
      <div className="font-mono text-[9px] text-muted-foreground mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function EconTile({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "muted" | "primary" | "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-lg tabular-nums mt-0.5",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-foreground/95",
        )}
      >
        {value}
      </div>
      <div className="font-mono text-[9px] text-muted-foreground mt-0.5 truncate">{sub}</div>
    </div>
  );
}
