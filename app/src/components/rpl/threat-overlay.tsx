import { Shield, AlertTriangle } from "lucide-react";
import { STRIDE_LABELS, STRIDE_COLORS, THREATS, type Stride } from "@/lib/threat-model";

export function ThreatLegend() {
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-danger" />
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-foreground/85">
          STRIDE threat model
        </h3>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STRIDE_LABELS) as Stride[]).map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono"
            style={{ borderColor: STRIDE_COLORS[s], color: STRIDE_COLORS[s] }}
          >
            <span className="font-semibold">{s}</span>
            <span className="text-muted-foreground">{STRIDE_LABELS[s]}</span>
          </span>
        ))}
      </div>

      <ul className="space-y-1.5 max-h-[260px] overflow-auto pr-1">
        {THREATS.map((t) => (
          <li key={t.id} className="rounded-lg border border-border bg-surface/40 p-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="h-3 w-3 shrink-0 mt-0.5"
                style={{ color: STRIDE_COLORS[t.stride] }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="font-mono text-[9px] px-1 py-0 rounded border"
                    style={{ borderColor: STRIDE_COLORS[t.stride], color: STRIDE_COLORS[t.stride] }}
                  >
                    {t.id} · {t.stride}
                  </span>
                  <span className="text-[11px] font-semibold text-foreground/95 truncate">
                    {t.name}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mb-0.5 truncate">
                  {t.asset}
                </div>
                <div className="text-[10px] text-foreground/75 leading-relaxed">{t.mitigation}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
