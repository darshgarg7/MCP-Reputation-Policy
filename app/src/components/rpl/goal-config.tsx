import { Loader2, RotateCcw, Send, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AgentGoal, GoalType, PriorityLevel, RiskLevel } from "@/lib/rpl-types";
import { GOAL_TYPES } from "@/lib/rpl-types";
import { GoalJsonPanel } from "./goal-json-panel";
import { WeightBars } from "./weight-bars";

interface Props {
  goal: AgentGoal;
  pending: boolean;
  onChangeField: <
    K extends "goal_type" | "risk_tolerance" | "latency_priority" | "accuracy_priority",
  >(
    key: K,
    value: AgentGoal[K],
  ) => void;
  onReset: () => void;
  onExecute: () => void;
}

const LEVELS: { value: RiskLevel; label: string; tone: "success" | "warning" | "danger" }[] = [
  { value: "low", label: "Low", tone: "success" },
  { value: "medium", label: "Medium", tone: "warning" },
  { value: "high", label: "High", tone: "danger" },
];

export function GoalConfig({ goal, pending, onChangeField, onReset, onExecute }: Props) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Agent Goal & Policy
          </h2>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw size={11} />
          reset
        </button>
      </header>

      <div className="space-y-4">
        {/* Task type */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Task Type
          </label>
          <Select
            value={goal.goal_type}
            onValueChange={(v) => onChangeField("goal_type", v as GoalType)}
          >
            <SelectTrigger className="mt-1.5 bg-surface/70 border-border h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_TYPES.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Segmented
          label="Risk Tolerance"
          value={goal.risk_tolerance}
          onChange={(v) => onChangeField("risk_tolerance", v)}
        />
        <Segmented
          label="Latency Priority"
          value={goal.latency_priority}
          onChange={(v) => onChangeField("latency_priority", v as PriorityLevel)}
        />
        <Segmented
          label="Accuracy Priority"
          value={goal.accuracy_priority}
          onChange={(v) => onChangeField("accuracy_priority", v as PriorityLevel)}
        />

        <div className="pt-1">
          <GoalJsonPanel goal={goal} />
        </div>

        <WeightBars weights={goal.derived_weights} />

        <Button
          onClick={onExecute}
          disabled={pending}
          className={cn(
            "w-full h-11 font-medium text-base relative overflow-hidden",
            "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground",
            "hover:opacity-95 transition-all",
            "shadow-[0_0_24px_-6px_oklch(0.84_0.21_148/55%)] hover:shadow-[0_0_32px_-4px_oklch(0.84_0.21_148/70%)]",
            "disabled:opacity-50 disabled:shadow-none",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Routing through Policy Engine…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Execute Agent Request
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

function Segmented({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RiskLevel | PriorityLevel;
  onChange: (v: RiskLevel & PriorityLevel) => void;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-surface/40 p-1">
        {LEVELS.map((lvl) => {
          const active = lvl.value === value;
          return (
            <button
              key={lvl.value}
              onClick={() => onChange(lvl.value as RiskLevel & PriorityLevel)}
              className={cn(
                "h-8 rounded-md text-xs font-medium font-mono transition-all duration-200",
                active
                  ? lvl.tone === "success"
                    ? "bg-success/15 text-success ring-1 ring-success/40"
                    : lvl.tone === "warning"
                      ? "bg-warning/15 text-warning ring-1 ring-warning/40"
                      : "bg-danger/15 text-danger ring-1 ring-danger/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
              )}
            >
              {lvl.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
