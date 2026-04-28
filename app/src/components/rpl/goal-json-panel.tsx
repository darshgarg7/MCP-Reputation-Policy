import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentGoal } from "@/lib/rpl-types";

export function GoalJsonPanel({ goal }: { goal: AgentGoal }) {
  const [pulse, setPulse] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPulse((n) => n + 1);
  }, [goal]);

  const json = JSON.stringify(
    {
      goal_type: goal.goal_type,
      risk_tolerance: goal.risk_tolerance,
      latency_priority: goal.latency_priority,
      accuracy_priority: goal.accuracy_priority,
      derived_weights: goal.derived_weights,
    },
    null,
    2,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative rounded-lg border border-border bg-surface/70 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface/60">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          GoalDescriptor.json
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre
        key={pulse}
        className={cn(
          "px-3 py-2.5 font-mono text-[11px] leading-relaxed overflow-x-auto",
          "animate-log-in",
        )}
      >
        <code>{syntaxHighlight(json)}</code>
      </pre>
    </div>
  );
}

function syntaxHighlight(json: string) {
  // Simple regex-based highlighter; returns array of spans.
  const tokens = json.split(/(".*?":|".*?"|\b(?:true|false|null)\b|-?\d+\.?\d*)/g);
  return tokens.map((t, i) => {
    if (!t) return null;
    if (/^".*":$/.test(t)) {
      return (
        <span key={i} className="text-success/90">
          {t}
        </span>
      );
    }
    if (/^".*"$/.test(t)) {
      return (
        <span key={i} className="text-warning/90">
          {t}
        </span>
      );
    }
    if (/^-?\d/.test(t)) {
      return (
        <span key={i} className="text-chart-4">
          {t}
        </span>
      );
    }
    if (/^(true|false|null)$/.test(t)) {
      return (
        <span key={i} className="text-danger/90">
          {t}
        </span>
      );
    }
    return (
      <span key={i} className="text-muted-foreground">
        {t}
      </span>
    );
  });
}
