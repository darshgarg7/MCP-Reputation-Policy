import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { computePolicyScore } from "@/lib/rpl-policy";
import type { AgentGoal, DataSource } from "@/lib/rpl-types";

interface Props {
  goal: AgentGoal;
  sources: DataSource[];
  highlightedSourceId: string | null;
  pending: boolean;
}

export function RoutingGraph({ goal, sources, highlightedSourceId, pending }: Props) {
  // When a request is dispatched we briefly fade non-chosen sources.
  const [fadeOthers, setFadeOthers] = useState(false);
  useEffect(() => {
    if (highlightedSourceId) {
      setFadeOthers(true);
      const id = window.setTimeout(() => setFadeOthers(false), 1300);
      return () => window.clearTimeout(id);
    }
  }, [highlightedSourceId]);

  const W = 560;
  const H = 240;
  const agent = { x: 60, y: H / 2 };
  const engine = { x: W / 2, y: H / 2 };

  const sourcePts = sources.slice(0, 5).map((s, i, arr) => {
    const y = 30 + (i * (H - 60)) / Math.max(1, arr.length - 1);
    return { x: W - 60, y, source: s };
  });

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="rpl-line" x1="0" x2="1">
            <stop offset="0%" stopColor="oklch(0.84 0.21 148)" stopOpacity="0.1" />
            <stop offset="50%" stopColor="oklch(0.84 0.21 148)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="oklch(0.84 0.21 148)" stopOpacity="0.1" />
          </linearGradient>
          <filter id="rpl-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Agent → Engine edge */}
        <line
          x1={agent.x}
          y1={agent.y}
          x2={engine.x}
          y2={engine.y}
          stroke="oklch(1 0 0 / 12%)"
          strokeWidth={1.2}
        />
        {pending && (
          <line
            x1={agent.x}
            y1={agent.y}
            x2={engine.x}
            y2={engine.y}
            stroke="url(#rpl-line)"
            strokeWidth={2}
            strokeDasharray="4 6"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="1s" repeatCount="indefinite" />
          </line>
        )}

        {/* Engine → each source edge */}
        {sourcePts.map(({ x, y, source }) => {
          const score = computePolicyScore(source, goal.derived_weights);
          const tone =
            score >= 0.7 ? "oklch(0.84 0.21 148)" : score >= 0.4 ? "oklch(0.82 0.17 70)" : "oklch(0.66 0.25 22)";
          const isChosen = source.source_id === highlightedSourceId;
          const op = fadeOthers && !isChosen ? 0.18 : 0.55;
          return (
            <g key={source.source_id}>
              <line
                x1={engine.x}
                y1={engine.y}
                x2={x}
                y2={y}
                stroke={tone}
                strokeOpacity={op}
                strokeWidth={isChosen ? 2.5 : 1}
              />
              {isChosen && (
                <line
                  x1={engine.x}
                  y1={engine.y}
                  x2={x}
                  y2={y}
                  stroke={tone}
                  strokeWidth={3}
                  strokeDasharray="3 5"
                  filter="url(#rpl-glow)"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-40"
                    dur="0.7s"
                    repeatCount="indefinite"
                  />
                </line>
              )}
            </g>
          );
        })}

        {/* Agent node */}
        <g>
          <circle
            cx={agent.x}
            cy={agent.y}
            r={pending ? 18 : 16}
            fill="oklch(0.84 0.21 148 / 12%)"
            stroke="oklch(0.84 0.21 148)"
            strokeWidth={1.5}
            filter={pending ? "url(#rpl-glow)" : undefined}
          />
          <text x={agent.x} y={agent.y + 4} textAnchor="middle" className="fill-success font-mono" fontSize="10">
            AGT
          </text>
          <text x={agent.x} y={agent.y + 36} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="9">
            agent
          </text>
        </g>

        {/* Policy engine node */}
        <g>
          <rect
            x={engine.x - 38}
            y={engine.y - 20}
            width={76}
            height={40}
            rx={8}
            fill="oklch(0.84 0.21 148 / 8%)"
            stroke="oklch(0.84 0.21 148 / 60%)"
            strokeWidth={1.2}
          />
          <text x={engine.x} y={engine.y - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
            POLICY
          </text>
          <text x={engine.x} y={engine.y + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="8">
            α·rep + β·acc + γ·lat
          </text>
        </g>

        {/* Source nodes */}
        {sourcePts.map(({ x, y, source }) => {
          const score = computePolicyScore(source, goal.derived_weights);
          const tone =
            score >= 0.7 ? "oklch(0.84 0.21 148)" : score >= 0.4 ? "oklch(0.82 0.17 70)" : "oklch(0.66 0.25 22)";
          const r = 6 + score * 8;
          const isChosen = source.source_id === highlightedSourceId;
          const op = fadeOthers && !isChosen ? 0.25 : 1;
          return (
            <g key={source.source_id} opacity={op} className="transition-opacity duration-300">
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={tone}
                fillOpacity={0.18}
                stroke={tone}
                strokeWidth={isChosen ? 2 : 1.2}
                filter={isChosen ? "url(#rpl-glow)" : undefined}
              />
              <text
                x={x + 14}
                y={y + 3}
                className="fill-foreground/90 font-mono"
                fontSize="9"
                textAnchor="start"
              >
                {source.source_id}
              </text>
              <text
                x={x + 14}
                y={y + 14}
                className="fill-muted-foreground font-mono"
                fontSize="8"
                textAnchor="start"
              >
                policy {score.toFixed(3)}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        className={cn(
          "absolute top-2 left-3 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono",
          "bg-surface/80 border border-border text-muted-foreground",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success animate-blink" />
        policy engine
      </div>
    </div>
  );
}
