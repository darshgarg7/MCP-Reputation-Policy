export type ToolType =
  | "MATH_COMPUTE"
  | "DATA_RETRIEVAL"
  | "REASONING"
  | "IMAGE_GEN"
  | "SEMANTIC_SEARCH";

export const TOOL_TYPES: ToolType[] = [
  "MATH_COMPUTE",
  "DATA_RETRIEVAL",
  "REASONING",
  "IMAGE_GEN",
  "SEMANTIC_SEARCH",
];

export type ServerStatus = "TRUSTED" | "BLOCKED";

export interface ServerState {
  server_id: string;
  tool_type: ToolType;
  score: number;
  status: ServerStatus;
  interactions: number;
}

export type OutcomeStatus = "SUCCESS" | "ERROR";

export interface ExecutionResult {
  server_id: string;
  outcome_status: OutcomeStatus;
  latency_sec: number;
  compute_cost: number;
  client_satisfaction: number;
  result: string;
  new_score: number;
}

export interface LogEntry extends ExecutionResult {
  id: string;
  tool_type: ToolType;
  prompt: string;
  prev_score: number;
  timestamp: number;
}

export const TRUST_THRESHOLD = 0.7;
