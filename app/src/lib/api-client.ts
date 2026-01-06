/**
 * Typed HTTP client for the RPL Python backend.
 * Single source of truth for base URL, request-id generation, error normalization.
 */

import type { DataSource, SourceTag, AgentGoal } from "./rpl-types";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000/api/v1";

// ---- Backend wire formats ----------------------------------------------------

export type ToolType =
  | "MATH_COMPUTE"
  | "WEB_SEARCH"
  | "FINANCIAL_DATA"
  | "RESEARCH_DB"
  | "NEWS_FEED"
  | "GENERAL";

export interface ApiServer {
  server_id: string;
  tool_type: ToolType;
  base_reputation: number;
  policy_score: number;
  status: "TRUSTED" | "CIRCUIT_BROKEN" | "QUARANTINED";
  interactions: number;
  cost_per_unit: number;
  history: number[];
  // Optional extensions the backend may add later — pass-through.
  last_latency?: number;
  confidence?: number;
}

export interface ApiServersResponse {
  servers: ApiServer[];
}

export interface ExecuteRequestBody {
  prompt: string;
  tool_type: ToolType;
  goal: {
    goal_type: string;
    risk_tolerance: "low" | "medium" | "high";
    latency_priority: "low" | "medium" | "high";
    accuracy_priority: "low" | "medium" | "high";
  };
}

export interface ExecuteResponse {
  transaction_id: string;
  server_id: string;
  outcome_status: "SUCCESS" | "FAILURE" | "TIMEOUT" | "ERROR";
  latency_sec: number;
  compute_cost: number;
  client_satisfaction: number;
  result: string;
  new_reputation_score: number;
  // Optional reasoning slot — backend may populate this later.
  reasoning?: string;
}

// ---- Adapter: ApiServer -> DataSource (existing UI shape) -------------------

const TOOL_TO_TAG: Record<ToolType, SourceTag> = {
  MATH_COMPUTE: "compute",
  WEB_SEARCH: "web",
  FINANCIAL_DATA: "financial",
  RESEARCH_DB: "research",
  NEWS_FEED: "news",
  GENERAL: "compute",
};

export function toolTypeToTag(t: ToolType): SourceTag {
  return TOOL_TO_TAG[t] ?? "compute";
}

export function normalizeServer(s: ApiServer): DataSource {
  // Backend status may include QUARANTINED — fold into CIRCUIT_BROKEN for legacy UI.
  const status = s.status === "TRUSTED" ? "TRUSTED" : "CIRCUIT_BROKEN";
  return {
    source_id: s.server_id,
    tag: toolTypeToTag(s.tool_type),
    base_reputation: +s.base_reputation.toFixed(4),
    confidence: s.confidence ?? 0.9,
    last_latency: s.last_latency ?? 0.5,
    status,
    history: s.history.length > 0 ? s.history : [s.base_reputation],
    interactions: s.interactions,
    tool_type: s.tool_type,
    cost_per_unit: s.cost_per_unit,
    policy_score_backend: s.policy_score,
  };
}

// ---- Goal -> backend payload -------------------------------------------------

export function goalToPayload(goal: AgentGoal): ExecuteRequestBody["goal"] {
  return {
    goal_type: goal.goal_type,
    risk_tolerance: goal.risk_tolerance,
    latency_priority: goal.latency_priority,
    accuracy_priority: goal.accuracy_priority,
  };
}

// ---- Fetch wrapper -----------------------------------------------------------

export class ApiError extends Error {
  status: number;
  requestId: string;
  body?: unknown;
  constructor(message: string, status: number, requestId: string, body?: unknown) {
    super(message);
    this.status = status;
    this.requestId = requestId;
    this.body = body;
  }
}

function newRequestId() {
  // 8-char hex — readable in toasts, copyable for log correlation.
  return `req_${Math.random().toString(16).slice(2, 10)}`;
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const requestId = newRequestId();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), init.timeoutMs ?? 15_000);
  const started = performance.now();

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      let body: unknown = undefined;
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      let detail = `${res.status} ${res.statusText}`;
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (typeof b.detail === "string") detail = b.detail;
        else if (typeof b.message === "string") detail = b.message;
      }
      throw new ApiError(detail, res.status, requestId, body);
    }

    const data = (await res.json()) as T;
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError("Request timed out", 0, requestId);
    }
    throw new ApiError(
      `Network error contacting ${API_BASE_URL} — is the backend running?`,
      0,
      requestId,
    );
  } finally {
    window.clearTimeout(timeout);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[api] ${path} ${(performance.now() - started).toFixed(0)}ms ${requestId}`);
    }
  }
}

// ---- Endpoints ---------------------------------------------------------------

export async function fetchServers(): Promise<DataSource[]> {
  const data = await request<ApiServersResponse>("/servers", { method: "GET" });
  return data.servers.map(normalizeServer);
}

export async function executeAgent(body: ExecuteRequestBody): Promise<ExecuteResponse> {
  return request<ExecuteResponse>("/execute", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 30_000,
  });
}
