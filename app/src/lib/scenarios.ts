import type { ToolType } from "./api-client";
import type { AgentGoal, RiskLevel } from "./rpl-types";
import { defaultGoal, deriveWeights } from "./rpl-policy";

export interface ScenarioStep {
  delayMs: number;
  caption: string;
  /** Optional execute call. If omitted, just shows the caption. */
  execute?: {
    prompt: string;
    tool_type: ToolType;
    demo_event?: "POISONED_SOURCE";
  };
  /** Optional goal mutation applied before this step's execute. */
  goalPatch?: Partial<Pick<AgentGoal, "risk_tolerance" | "latency_priority" | "accuracy_priority">>;
}

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  durationLabel: string;
  initialGoal: () => AgentGoal;
  steps: ScenarioStep[];
}

function goalWith(patch: Partial<Pick<AgentGoal, "risk_tolerance" | "latency_priority" | "accuracy_priority">>): AgentGoal {
  const base = defaultGoal();
  const merged = { ...base, ...patch };
  return {
    ...merged,
    derived_weights: deriveWeights({
      risk_tolerance: merged.risk_tolerance as RiskLevel,
      accuracy_priority: merged.accuracy_priority,
      latency_priority: merged.latency_priority,
    }),
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "poisoning",
    title: "Reputation poisoning attack",
    blurb:
      "A previously trusted source begins returning low-quality results. Watch the reputation collapse, the circuit breaker trip, and traffic re-route to the failover.",
    durationLabel: "~60s · 8 events",
    initialGoal: () => goalWith({ risk_tolerance: "medium", accuracy_priority: "high", latency_priority: "medium" }),
    steps: [
      { delayMs: 800, caption: "T+0 · Baseline traffic — primary source serving requests" },
      { delayMs: 1500, caption: "T+1.5 · Routine financial query", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA" } },
      { delayMs: 4000, caption: "T+5 · Adversary begins poisoning — satisfaction drops" },
      { delayMs: 1500, caption: "T+6.5 · Same query, poisoned result", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA", demo_event: "POISONED_SOURCE" } },
      { delayMs: 3500, caption: "T+10 · Reputation crossing trust threshold" },
      { delayMs: 1500, caption: "T+11.5 · Second poisoned result trips the route", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA", demo_event: "POISONED_SOURCE" } },
      { delayMs: 3000, caption: "T+14.5 · Failover stable on backup source" },
      { delayMs: 1500, caption: "T+16 · Verifying recovery", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA" } },
    ],
  },
  {
    id: "goal-shift",
    title: "Goal change re-routes traffic",
    blurb:
      "Mid-flight risk-tolerance change from low → high. The policy engine re-weights instantly and the routing graph re-paints to a faster, cheaper source.",
    durationLabel: "~30s · 6 events",
    initialGoal: () => goalWith({ risk_tolerance: "low", accuracy_priority: "high", latency_priority: "low" }),
    steps: [
      { delayMs: 800, caption: "T+0 · Conservative policy — favoring trusted sources" },
      { delayMs: 1500, caption: "T+1.5 · Research query under low risk", execute: { prompt: "Summarize recent EU AI Act updates", tool_type: "RESEARCH_DB" } },
      { delayMs: 3500, caption: "T+5 · Operator increases risk tolerance to HIGH", goalPatch: { risk_tolerance: "high", latency_priority: "high" } },
      { delayMs: 1500, caption: "T+6.5 · Re-routing to lower-latency source", execute: { prompt: "Summarize recent EU AI Act updates", tool_type: "RESEARCH_DB" } },
      { delayMs: 2500, caption: "T+9 · Same task, faster path" },
      { delayMs: 1500, caption: "T+10.5 · Confirming new steady state", execute: { prompt: "Summarize recent EU AI Act updates", tool_type: "RESEARCH_DB" } },
    ],
  },
  {
    id: "noisy-neighbor",
    title: "Noisy-neighbor quarantine",
    blurb:
      "A high-latency source slowly bleeds the latency budget. After repeated SLO violations, the policy engine quarantines it autonomously.",
    durationLabel: "~45s · 7 events",
    initialGoal: () => goalWith({ risk_tolerance: "medium", accuracy_priority: "medium", latency_priority: "high" }),
    steps: [
      { delayMs: 800, caption: "T+0 · Sub-second SLO active, latency_priority=HIGH" },
      { delayMs: 1500, caption: "T+1.5 · Compute task #1", execute: { prompt: "Compute moving averages for sample series", tool_type: "MATH_COMPUTE" } },
      { delayMs: 1500, caption: "T+3 · Compute task #2 — latency creeping up", execute: { prompt: "Compute moving averages for sample series", tool_type: "MATH_COMPUTE" } },
      { delayMs: 1500, caption: "T+4.5 · Compute task #3 — SLO violation", execute: { prompt: "Compute moving averages for sample series", tool_type: "MATH_COMPUTE" } },
      { delayMs: 2500, caption: "T+7 · Policy engine flags repeat offender" },
      { delayMs: 1500, caption: "T+8.5 · Compute task #4 — routed elsewhere", execute: { prompt: "Compute moving averages for sample series", tool_type: "MATH_COMPUTE" } },
      { delayMs: 2500, caption: "T+11 · Quarantine confirmed · monitoring resumes" },
    ],
  },
  {
    id: "bedrock-failover",
    title: "Regional Bedrock failover (us-east-1 → us-west-2)",
    blurb:
      "Simulated AZ-wide Bedrock throttle in us-east-1. Watch reputations for us-east-1 sources collapse over 3 ticks while RPL routes new traffic to us-west-2 reputations until the region recovers.",
    durationLabel: "~50s · 9 events",
    initialGoal: () => goalWith({ risk_tolerance: "low", accuracy_priority: "high", latency_priority: "high" }),
    steps: [
      { delayMs: 800, caption: "T+0 · Steady state · multi-region traffic" },
      { delayMs: 1500, caption: "T+1.5 · Baseline request", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA" } },
      { delayMs: 2500, caption: "T+4 · INCIDENT · Bedrock throttle in us-east-1 (simulated)" },
      { delayMs: 1500, caption: "T+5.5 · us-east-1 source returns degraded result", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA" } },
      { delayMs: 1500, caption: "T+7 · Reputation collapse on us-east-1 reputations", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA" } },
      { delayMs: 2500, caption: "T+9.5 · Trust threshold crossed · re-routing to us-west-2" },
      { delayMs: 1500, caption: "T+11 · Verifying us-west-2 path", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA" } },
      { delayMs: 3000, caption: "T+14 · us-east-1 throttle clears · cooldown holds traffic in us-west-2" },
      { delayMs: 1500, caption: "T+15.5 · Steady state on us-west-2", execute: { prompt: "Get latest AAPL close price", tool_type: "FINANCIAL_DATA" } },
    ],
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
