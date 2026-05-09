import type {
  AgentGoal,
  DataSource,
  DerivedWeights,
  PriorityLevel,
  RiskLevel,
} from "./rpl-types";
import { REPUTATION_BASELINE } from "./rpl-types";

const RISK_TO_ALPHA: Record<RiskLevel, number> = { low: 0.6, medium: 0.4, high: 0.2 };
const ACC_TO_BETA: Record<PriorityLevel, number> = { low: 0.1, medium: 0.3, high: 0.5 };
const LAT_TO_GAMMA: Record<PriorityLevel, number> = { low: 0.1, medium: 0.3, high: 0.5 };

export function deriveWeights(goal: {
  risk_tolerance: RiskLevel;
  accuracy_priority: PriorityLevel;
  latency_priority: PriorityLevel;
}): DerivedWeights {
  const a = RISK_TO_ALPHA[goal.risk_tolerance];
  const b = ACC_TO_BETA[goal.accuracy_priority];
  const c = LAT_TO_GAMMA[goal.latency_priority];
  const sum = a + b + c;
  const alpha = +(a / sum).toFixed(2);
  const beta = +(b / sum).toFixed(2);
  // Last weight absorbs rounding drift so they sum to exactly 1.00.
  const gamma = +(1 - alpha - beta).toFixed(2);
  return { alpha_rep: alpha, beta_acc: beta, gamma_lat: gamma };
}

export function latencyScore(last_latency: number) {
  return Math.max(0, Math.min(1, 1 - last_latency / 2));
}

export function computePolicyScore(source: DataSource, w: DerivedWeights) {
  const acc = source.base_reputation * source.confidence;
  const lat = latencyScore(source.last_latency);
  const policy =
    w.alpha_rep * source.base_reputation + w.beta_acc * acc + w.gamma_lat * lat;
  return +Math.max(0, Math.min(1, policy)).toFixed(4);
}

export function thresholdForRiskTolerance(risk: RiskLevel) {
  if (risk === "low") return 0.85;
  if (risk === "high") return 0.5;
  return 0.7;
}

/** One decay tick: drift score toward baseline. */
export function decayScore(current: number, decayRate = 0.015) {
  return REPUTATION_BASELINE + (current - REPUTATION_BASELINE) * Math.exp(-decayRate);
}

export function statusFor(score: number) {
  return score >= 0.7 ? "TRUSTED" : "CIRCUIT_BROKEN";
}

export function formulaLabel(w: DerivedWeights) {
  const f = (n: number) => n.toFixed(2);
  return `${f(w.alpha_rep)}·rep + ${f(w.beta_acc)}·acc + ${f(w.gamma_lat)}·lat`;
}

export function defaultGoal(): AgentGoal {
  const base = {
    goal_type: "financial_analysis" as const,
    risk_tolerance: "low" as RiskLevel,
    latency_priority: "medium" as PriorityLevel,
    accuracy_priority: "high" as PriorityLevel,
  };
  return { ...base, derived_weights: deriveWeights(base) };
}
