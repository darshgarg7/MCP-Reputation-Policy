import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import type { Pillar } from "@/lib/well-architected";
import { cn } from "@/lib/utils";

const ACCENT_TOKEN: Record<Pillar["accent"], string> = {
  primary: "text-success border-success/40 bg-success/5",
  warning: "text-warning border-warning/40 bg-warning/5",
  danger: "text-danger border-danger/40 bg-danger/5",
  info: "text-chart-4 border-chart-4/40 bg-chart-4/5",
  violet: "text-chart-5 border-chart-5/40 bg-chart-5/5",
  amber: "text-warning border-warning/40 bg-warning/5",
};

const ACCENT_BAR: Record<Pillar["accent"], string> = {
  primary: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-chart-4",
  violet: "bg-chart-5",
  amber: "bg-warning",
};

export function PillarCard({ pillar }: { pillar: Pillar }) {
  const pct = (pillar.score / 5) * 100;
  return (
    <article className={cn("glass rounded-2xl p-5 sm:p-6 flex flex-col h-full")}>
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                ACCENT_TOKEN[pillar.accent],
              )}
            >
              {pillar.short}
            </span>
            <ShieldCheck className="h-3 w-3 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground/95 leading-tight">{pillar.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{pillar.tagline}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-semibold tabular-nums text-foreground/95">
            {pillar.score.toFixed(1)}
            <span className="text-xs font-normal text-muted-foreground">/5</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">score</div>
        </div>
      </header>

      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden mb-4">
        <div className={cn("h-full transition-all duration-700", ACCENT_BAR[pillar.accent])} style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-2.5 flex-1">
        {pillar.evidence.map((e, i) => (
          <li key={i} className="rounded-lg border border-border bg-surface/40 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[12px] font-semibold text-foreground/95 leading-snug">{e.title}</span>
              {e.href && (
                <Link
                  to={e.href}
                  className="shrink-0 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-wider text-foreground/70 hover:text-foreground border border-border rounded px-1.5 py-0.5"
                >
                  {e.hrefLabel ?? "open"} <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{e.detail}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
