import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AWS_SERVICES,
  FLOW_EDGES,
  LAYER_COLORS,
  LAYER_LABELS,
  TRACE_PATH,
  type AwsService,
} from "@/lib/aws-architecture";
import { THREAT_EDGES, TRUST_BOUNDARIES, STRIDE_COLORS } from "@/lib/threat-model";
import { IamDrawer } from "@/components/rpl/iam-drawer";
import { Cpu, Database, Network, Cloud, Activity, Server, ShieldCheck } from "lucide-react";

const ICONS: Record<string, typeof Cpu> = {
  edge: Network,
  compute: Server,
  agent: Cpu,
  state: Database,
  stream: Activity,
  observe: Cloud,
  governance: ShieldCheck,
};

interface Props {
  onSelect: (svc: AwsService | null) => void;
  selectedId: string | null;
  traceTick: number; // increments to retrigger the trace animation
  showThreats?: boolean;
}

const COL_W = 200;
const ROW_H = 130;
const PAD_X = 40;
const PAD_Y = 40;
const NODE_W = 168;
const NODE_H = 92;

function nodePos(svc: AwsService) {
  return {
    x: PAD_X + svc.col * COL_W,
    y: PAD_Y + svc.row * ROW_H,
    cx: PAD_X + svc.col * COL_W + NODE_W / 2,
    cy: PAD_Y + svc.row * ROW_H + NODE_H / 2,
  };
}

export function ArchitectureDiagram({ onSelect, selectedId, traceTick, showThreats = false }: Props) {
  const cols = Math.max(...AWS_SERVICES.map((s) => s.col)) + 1;
  const rows = Math.max(...AWS_SERVICES.map((s) => s.row)) + 1;
  const width = PAD_X * 2 + (cols - 1) * COL_W + NODE_W;
  const height = PAD_Y * 2 + (rows - 1) * ROW_H + NODE_H;

  // Trace path edges (consecutive pairs).
  const traceEdges = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < TRACE_PATH.length - 1; i++) {
      set.add(`${TRACE_PATH[i]}->${TRACE_PATH[i + 1]}`);
    }
    return set;
  }, []);

  // Build STRIDE labels per edge for fast lookup.
  const threatByEdge = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of THREAT_EDGES) m.set(`${t.from}->${t.to}`, t.stride);
    return m;
  }, []);

  // Compute trust-boundary bounding boxes from member node positions.
  const boundaries = useMemo(() => {
    return TRUST_BOUNDARIES.map((b) => {
      const members = AWS_SERVICES.filter((s) => b.nodes.includes(s.id));
      if (members.length === 0) return null;
      const xs = members.map((s) => nodePos(s).x);
      const ys = members.map((s) => nodePos(s).y);
      return {
        ...b,
        x: Math.min(...xs) - 12,
        y: Math.min(...ys) - 22,
        w: Math.max(...xs) + NODE_W + 12 - (Math.min(...xs) - 12),
        h: Math.max(...ys) + NODE_H + 12 - (Math.min(...ys) - 22),
      };
    }).filter(Boolean) as Array<{ id: string; label: string; color: string; x: number; y: number; w: number; h: number }>;
  }, []);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface/40 bg-grid">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: width, height }}
        className="block"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="oklch(1 0 0 / 35%)" />
          </marker>
          <marker
            id="arrow-trace"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="oklch(0.84 0.21 148)" />
          </marker>
        </defs>

        {/* Trust boundaries */}
        {showThreats &&
          boundaries.map((b) => (
            <g key={b.id}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={14}
                fill={b.color}
                fillOpacity={0.04}
                stroke={b.color}
                strokeOpacity={0.5}
                strokeDasharray="6 4"
                strokeWidth={1.2}
              />
              <text
                x={b.x + 10}
                y={b.y + 14}
                fill={b.color}
                fontSize={9}
                fontFamily="ui-monospace, monospace"
                style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {b.label}
              </text>
            </g>
          ))}
        {/* Edges */}
        {FLOW_EDGES.map((e, i) => {
          const a = AWS_SERVICES.find((s) => s.id === e.from);
          const b = AWS_SERVICES.find((s) => s.id === e.to);
          if (!a || !b) return null;
          const pa = nodePos(a);
          const pb = nodePos(b);
          const isTrace = traceEdges.has(`${e.from}->${e.to}`);
          const traceIndex = TRACE_PATH.indexOf(e.from);
          return (
            <g key={i}>
              <line
                x1={pa.cx}
                y1={pa.cy}
                x2={pb.cx}
                y2={pb.cy}
                stroke={isTrace ? "oklch(0.84 0.21 148 / 35%)" : "oklch(1 0 0 / 12%)"}
                strokeWidth={isTrace ? 1.4 : 1}
                strokeDasharray={isTrace ? "0" : "3 3"}
                markerEnd={isTrace ? "url(#arrow-trace)" : "url(#arrow)"}
              />
              {isTrace && traceTick > 0 && (
                <circle
                  key={`${i}-${traceTick}`}
                  r={4}
                  fill="oklch(0.84 0.21 148)"
                  opacity={0.95}
                >
                  <animateMotion
                    dur="0.6s"
                    begin={`${traceIndex * 0.55}s`}
                    fill="freeze"
                    path={`M ${pa.cx} ${pa.cy} L ${pb.cx} ${pb.cy}`}
                    repeatCount="1"
                  />
                  <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="0.6s" begin={`${traceIndex * 0.55}s`} fill="freeze" />
                </circle>
              )}
              {showThreats && threatByEdge.has(`${e.from}->${e.to}`) && (
                <g>
                  {(threatByEdge.get(`${e.from}->${e.to}`) ?? []).map((s, idx) => {
                    const mx = (pa.cx + pb.cx) / 2 + idx * 14 - 7;
                    const my = (pa.cy + pb.cy) / 2 - 6;
                    return (
                      <g key={s + idx}>
                        <rect x={mx - 7} y={my - 7} width={14} height={14} rx={3} fill="oklch(0.16 0.018 250 / 90%)" stroke={STRIDE_COLORS[s as keyof typeof STRIDE_COLORS]} strokeWidth={1} />
                        <text x={mx} y={my + 3} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill={STRIDE_COLORS[s as keyof typeof STRIDE_COLORS]} fontWeight={700}>{s}</text>
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {AWS_SERVICES.map((svc) => {
          const p = nodePos(svc);
          const isSelected = selectedId === svc.id;
          const Icon = ICONS[svc.layer] ?? Server;
          const color = LAYER_COLORS[svc.layer];
          return (
            <g
              key={svc.id}
              transform={`translate(${p.x}, ${p.y})`}
              className="cursor-pointer"
              onClick={() => onSelect(isSelected ? null : svc)}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill="oklch(0.21 0.02 252 / 95%)"
                stroke={isSelected ? color : "oklch(1 0 0 / 12%)"}
                strokeWidth={isSelected ? 2 : 1}
              />
              <rect width={4} height={NODE_H} rx={2} fill={color} />
              <foreignObject x={14} y={10} width={NODE_W - 24} height={NODE_H - 16}>
                <div className="flex flex-col h-full justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3 w-3" style={{ color }} strokeWidth={2.5} />
                    <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color }}>
                      {LAYER_LABELS[svc.layer]}
                    </span>
                  </div>
                  <div className="text-[12px] font-semibold text-foreground/95 leading-tight truncate">
                    {svc.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">
                    {svc.short}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ServicePanel({ svc, onClose }: { svc: AwsService; onClose: () => void }) {
  const Icon = ICONS[svc.layer] ?? Server;
  const color = LAYER_COLORS[svc.layer];
  const [tab, setTab] = useState<"overview" | "iam">("overview");
  return (
    <aside className="glass rounded-2xl p-5 sm:p-6 sticky top-20 self-start">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className="h-3.5 w-3.5" style={{ color }} strokeWidth={2.5} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
              {LAYER_LABELS[svc.layer]}
            </span>
          </div>
          <h3 className="text-base font-semibold text-foreground/95">{svc.name}</h3>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{svc.short}</p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs font-mono px-2 py-1 rounded border border-border"
        >
          esc
        </button>
      </div>

      <div className="flex items-center gap-1 mb-3 border-b border-border">
        {(["overview", "iam"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-success text-foreground/95"
                : "border-transparent text-muted-foreground hover:text-foreground/80",
            )}
          >
            {t === "iam" ? "IAM" : "Overview"}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-3 text-sm">
          <Section label="Role">
            <p className="text-foreground/85 leading-relaxed">{svc.role}</p>
          </Section>
          <Section label="Permissions (summary)">
            <ul className="space-y-1">
              {svc.iam.map((p, i) => (
                <li key={i} className="font-mono text-[11px] text-foreground/80">
                  <span className="text-muted-foreground">▸</span> {p}
                </li>
              ))}
            </ul>
          </Section>
          <div className="grid grid-cols-2 gap-2">
            <Section label="Data in">
              <p className="font-mono text-[11px] text-foreground/80">{svc.dataIn}</p>
            </Section>
            <Section label="Data out">
              <p className="font-mono text-[11px] text-foreground/80">{svc.dataOut}</p>
            </Section>
          </div>
        </div>
      ) : (
        <IamDrawer serviceId={svc.id} />
      )}
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn("font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1")}>
        {label}
      </div>
      {children}
    </div>
  );
}
