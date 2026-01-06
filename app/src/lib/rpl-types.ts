export type RiskLevel = "low" | "medium" | "high";
export type PriorityLevel = "low" | "medium" | "high";

export type GoalType =
  | "financial_analysis"
  | "casual_chat"
  | "real_time_trading"
  | "research"
  | "customer_support";

export const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "financial_analysis", label: "Financial Analysis" },
  { value: "casual_chat", label: "Casual Chat" },
  { value: "real_time_trading", label: "Real-time Trading" },
  { value: "research", label: "Research" },
  { value: "customer_support", label: "Customer Support" },
];

export interface DerivedWeights {
  alpha_rep: number;
  beta_acc: number;
  gamma_lat: number;
}

export interface AgentGoal {
  goal_type: GoalType;
  risk_tolerance: RiskLevel;
  latency_priority: PriorityLevel;
  accuracy_priority: PriorityLevel;
  derived_weights: DerivedWeights;
}

export type SourceStatus = "TRUSTED" | "CIRCUIT_BROKEN";

export type SourceTag = "financial" | "web" | "research" | "compute" | "news";

export interface DataSource {
  source_id: string;
  tag: SourceTag;
  base_reputation: number;
  confidence: number;
  last_latency: number;
  status: SourceStatus;
  history: number[];
  interactions: number;
  /** Original backend tool_type if the row came from /servers. */
  tool_type?: string;
  /** Backend-reported policy score (advisory; UI still recomputes locally for the active goal). */
  policy_score_backend?: number;
  /** Cost per unit reported by the backend, used by the comparison panel. */
  cost_per_unit?: number;
}

export type Outcome = "SUCCESS" | "ERROR";

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  goal: AgentGoal;
  chosen_source_id: string;
  policy_score: number;
  outcome: Outcome;
  latency_sec: number;
  relevance: number;
  prev_reputation: number;
  new_reputation: number;
}

export const TRUST_THRESHOLD = 0.7;
export const REPUTATION_BASELINE = 0.5;
