import type { ExecutionResult, ServerState, ToolType } from "./mcp-types";

/**
 * Mock router + executor. Mirrors the eventual Python API response shape so
 * swapping to `fetch('/api/execute')` later is a one-line change.
 */
export async function mockExecuteTask(params: {
  tool_type: ToolType;
  prompt: string;
  servers: ServerState[];
}): Promise<ExecutionResult | null> {
  const { tool_type, prompt, servers } = params;

  // Simulate network / agent thinking time.
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 300));

  const candidates = servers.filter((s) => s.tool_type === tool_type);
  if (candidates.length === 0) return null;

  // Bias selection toward higher-scoring servers (the agent's job).
  const weights = candidates.map((s) => Math.max(0.05, s.score));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = Math.random() * total;
  let chosen = candidates[0];
  for (let i = 0; i < candidates.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      chosen = candidates[i];
      break;
    }
  }

  // ~85% success, lower-score servers a bit more flaky.
  const successProb = 0.7 + chosen.score * 0.25;
  const success = Math.random() < successProb;

  const latency = +(0.1 + Math.random() * 1.9).toFixed(2);
  const cost = +(0.001 + Math.random() * 0.019).toFixed(4);
  const satisfaction = success
    ? +(0.6 + Math.random() * 0.4).toFixed(2)
    : +(Math.random() * 0.4).toFixed(2);

  // Reputation update: drift current score toward observed satisfaction
  // with a small decay term, clamped to [0, 1].
  const decay = 0.01;
  const learn = 0.18;
  const drifted = chosen.score * (1 - decay) + (satisfaction - chosen.score) * learn;
  const new_score = +Math.max(0, Math.min(1, drifted)).toFixed(4);

  const result = success
    ? `Result for "${truncate(prompt, 60)}". Used ${Math.floor(20 + Math.random() * 180)} units.`
    : `Execution failed for "${truncate(prompt, 60)}". Server returned non-zero status.`;

  return {
    server_id: chosen.server_id,
    outcome_status: success ? "SUCCESS" : "ERROR",
    latency_sec: latency,
    compute_cost: cost,
    client_satisfaction: satisfaction,
    result,
    new_score,
  };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
