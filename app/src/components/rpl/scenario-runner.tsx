import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipForward, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/lib/scenarios";
import type { AgentGoal } from "@/lib/rpl-types";
import type { ToolType } from "@/lib/api-client";

export interface ScenarioRunnerProps {
  scenario: Scenario;
  /** Apply a goal mutation immediately (e.g. mid-scenario risk change). */
  setGoal: (g: AgentGoal) => void;
  /** Execute one agent request through the real backend. */
  executeRequest: (opts: { prompt: string; tool_type: ToolType; demo_event?: "POISONED_SOURCE" }) => Promise<{ ok: boolean }>;
  onClose: () => void;
}

interface RunState {
  step: number;
  paused: boolean;
  done: boolean;
  caption: string;
  successes: number;
  failures: number;
  startedAt: number;
}

export function ScenarioRunner({ scenario, setGoal, executeRequest, onClose }: ScenarioRunnerProps) {
  const [state, setState] = useState<RunState>(() => ({
    step: 0,
    paused: false,
    done: false,
    caption: scenario.steps[0]?.caption ?? "",
    successes: 0,
    failures: 0,
    startedAt: Date.now(),
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const cancelled = useRef(false);

  const runStep = useCallback(
    async (idx: number) => {
      if (cancelled.current) return;
      if (idx >= scenario.steps.length) {
        setState((s) => ({ ...s, done: true, caption: "Scenario complete." }));
        return;
      }
      const step = scenario.steps[idx];
      // Wait for the step delay (or pause).
      const start = Date.now();
      while (Date.now() - start < step.delayMs) {
        if (cancelled.current) return;
        if (stateRef.current.paused) {
          await sleep(120);
          continue;
        }
        await sleep(80);
      }
      if (cancelled.current) return;

      // Apply goal patch if any.
      if (step.goalPatch) {
        const base = scenario.initialGoal();
        setGoal({
          ...base,
          ...step.goalPatch,
          derived_weights: base.derived_weights, // recomputed by store on field set, but we set directly here
        });
      }

      setState((s) => ({ ...s, step: idx, caption: step.caption }));

      // Execute if specified.
      if (step.execute) {
        const res = await executeRequest({
          prompt: step.execute.prompt,
          tool_type: step.execute.tool_type,
          demo_event: step.execute.demo_event,
        });
        setState((s) => ({
          ...s,
          successes: s.successes + (res.ok ? 1 : 0),
          failures: s.failures + (res.ok ? 0 : 1),
        }));
      }

      runStep(idx + 1);
    },
    [scenario, executeRequest, setGoal],
  );

  // Kick off on mount.
  useEffect(() => {
    cancelled.current = false;
    setGoal(scenario.initialGoal());
    runStep(0);
    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  const progress = state.done
    ? 1
    : Math.min(1, (state.step + 1) / scenario.steps.length);

  function restart() {
    cancelled.current = true;
    setTimeout(() => {
      cancelled.current = false;
      setState({ step: 0, paused: false, done: false, caption: scenario.steps[0]?.caption ?? "", successes: 0, failures: 0, startedAt: Date.now() });
      setGoal(scenario.initialGoal());
      runStep(0);
    }, 200);
  }

  function skip() {
    cancelled.current = true;
    setTimeout(() => {
      cancelled.current = false;
      setState((s) => ({ ...s, done: true, caption: "Skipped." }));
    }, 100);
  }

  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);

  return (
    <div className="fixed top-14 left-0 right-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-wider text-success bg-success/15 px-2 py-0.5 rounded">
              SCENARIO
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{scenario.title}</div>
              <div className="text-[11px] font-mono text-muted-foreground truncate">{state.caption}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Stat label="Step" value={`${Math.min(state.step + 1, scenario.steps.length)} / ${scenario.steps.length}`} />
            <Stat label="OK" value={state.successes} tone="success" />
            <Stat label="Fail" value={state.failures} tone={state.failures > 0 ? "danger" : "muted"} />
            <Stat label="Elapsed" value={`${elapsed}s`} />
            <div className="flex items-center gap-1 ml-2">
              <ControlBtn onClick={() => setState((s) => ({ ...s, paused: !s.paused }))} title={state.paused ? "Resume" : "Pause"}>
                {state.paused ? <Play size={12} /> : <Pause size={12} />}
              </ControlBtn>
              <ControlBtn onClick={skip} title="Skip">
                <SkipForward size={12} />
              </ControlBtn>
              <ControlBtn onClick={restart} title="Restart">
                <RotateCcw size={12} />
              </ControlBtn>
              <ControlBtn onClick={onClose} title="Close">
                <X size={12} />
              </ControlBtn>
            </div>
          </div>
        </div>
        <div className="h-1 w-full bg-muted/60 rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-500", state.done ? "bg-success" : "bg-primary")}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ControlBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="h-7 w-7 rounded-md border border-border bg-surface/60 grid place-items-center text-foreground/80 hover:text-foreground hover:bg-accent transition-colors"
    >
      {children}
    </button>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: string | number; tone?: "muted" | "success" | "danger" }) {
  return (
    <div className="hidden sm:flex flex-col items-end leading-tight">
      <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          tone === "muted" && "text-foreground/85",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
