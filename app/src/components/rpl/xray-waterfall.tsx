import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface Span {
  service: string;
  op: string;
  startMs: number;
  durMs: number;
  tone: "edge" | "compute" | "agent" | "state" | "stream";
  meta: Record<string, string>;
}

const TONE: Record<Span["tone"], string> = {
  edge: "bg-chart-4",
  compute: "bg-success",
  agent: "bg-chart-5",
  state: "bg-warning",
  stream: "bg-chart-4",
};

const SPANS: Span[] = [
  {
    service: "CloudFront",
    op: "edge.handle",
    startMs: 0,
    durMs: 8,
    tone: "edge",
    meta: { region: "us-east-1", "edge.pop": "IAD-89", "tls.version": "1.3" },
  },
  {
    service: "API Gateway",
    op: "POST /v1/execute",
    startMs: 8,
    durMs: 6,
    tone: "edge",
    meta: { authorizer: "cognito-jwt", "request.id": "f7c2-8a91" },
  },
  {
    service: "ECS · FastAPI",
    op: "policy.score",
    startMs: 14,
    durMs: 5,
    tone: "compute",
    meta: { "task.id": "rpl-api/3a", "rep.alpha": "0.62" },
  },
  {
    service: "ElastiCache",
    op: "GET reputation:srv_2",
    startMs: 19,
    durMs: 1,
    tone: "state",
    meta: { hit: "true", "ttl.ms": "1800" },
  },
  {
    service: "ECS · FastAPI",
    op: "bedrock.invoke",
    startMs: 20,
    durMs: 142,
    tone: "compute",
    meta: { model: "claude-3-5-sonnet", "tokens.in": "1241", "tokens.out": "388" },
  },
  {
    service: "Bedrock",
    op: "model.complete",
    startMs: 24,
    durMs: 134,
    tone: "agent",
    meta: { "guardrail.id": "rpl-default", "stop.reason": "end_turn" },
  },
  {
    service: "DynamoDB",
    op: "UpdateItem reputation",
    startMs: 165,
    durMs: 4,
    tone: "state",
    meta: { "consumed.wcu": "1", "conditional.check": "true" },
  },
  {
    service: "Kinesis",
    op: "PutRecord telemetry",
    startMs: 169,
    durMs: 3,
    tone: "stream",
    meta: { "shard.id": "shard-2", "seq.num": "49649…" },
  },
];

const TOTAL = 175;

export function XrayWaterfall() {
  const [selected, setSelected] = useState<Span | null>(SPANS[4]);
  const totalWidth = useMemo(() => Math.max(...SPANS.map((s) => s.startMs + s.durMs)), []);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-xl border border-border bg-surface/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            trace · 1-65f4a2-d8b32910eb·rpl
          </div>
          <div className="font-mono text-[10px] tabular-nums text-foreground/80">
            total {TOTAL}ms · 8 spans
          </div>
        </div>
        <div className="space-y-1.5">
          {SPANS.map((s, i) => {
            const left = (s.startMs / totalWidth) * 100;
            const width = Math.max(0.8, (s.durMs / totalWidth) * 100);
            const isSel = selected?.op === s.op && selected?.service === s.service;
            return (
              <button
                key={i}
                onClick={() => setSelected(s)}
                className={cn(
                  "w-full text-left grid grid-cols-[140px_1fr_60px] items-center gap-2 px-2 py-1.5 rounded-md border transition-colors",
                  isSel ? "border-success/50 bg-success/5" : "border-transparent hover:border-border hover:bg-surface/60",
                )}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-foreground/95 truncate">{s.service}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">{s.op}</div>
                </div>
                <div className="relative h-4 bg-muted/40 rounded">
                  <div
                    className={cn("absolute top-0 h-full rounded", TONE[s.tone])}
                    style={{ left: `${left}%`, width: `${width}%`, opacity: 0.85 }}
                  />
                </div>
                <div className="font-mono text-[10px] tabular-nums text-foreground/80 text-right">
                  {s.durMs}ms
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="rounded-xl border border-border bg-surface/40 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Span detail
        </div>
        {selected ? (
          <>
            <div className="text-[12px] font-semibold text-foreground/95">{selected.service}</div>
            <div className="text-[11px] font-mono text-muted-foreground mb-3">{selected.op}</div>
            <dl className="space-y-1.5">
              {Object.entries(selected.meta).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-[10px] tabular-nums text-foreground/85 truncate max-w-[160px] text-right">
                    {v}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">duration</dt>
                <dd className="font-mono text-[10px] tabular-nums text-foreground/85">{selected.durMs}ms</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">offset</dt>
                <dd className="font-mono text-[10px] tabular-nums text-foreground/85">+{selected.startMs}ms</dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="text-[11px] text-muted-foreground">Select a span.</div>
        )}
      </aside>
    </div>
  );
}
