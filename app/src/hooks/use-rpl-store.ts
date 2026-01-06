/**
 * RPL store — thin wrapper around TanStack Query.
 * - useServers(): polls GET /servers every 5s.
 * - useExecuteAgent(): mutation that invalidates ['servers'] and pushes telemetry.
 *
 * Goal config + chart selection + telemetry buffer remain client-local state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  executeAgent,
  goalToPayload,
  type ExecuteResponse,
  type ToolType,
} from "@/lib/api-client";
import { serversQueryOptions, SERVERS_QUERY_KEY } from "@/lib/queries";
import { computePolicyScore, defaultGoal, deriveWeights } from "@/lib/rpl-policy";
import { telemetryStore, useTelemetry } from "@/lib/telemetry-store";
import type {
  AgentGoal,
  DataSource,
  PriorityLevel,
  RiskLevel,
  TelemetryEvent,
} from "@/lib/rpl-types";

export interface RplStore {
  goal: AgentGoal;
  setGoal: (g: AgentGoal) => void;
  sources: DataSource[];
  isLoadingSources: boolean;
  isFetchingSources: boolean;
  sourcesError: ApiError | null;
  refetchSources: () => void;
  events: TelemetryEvent[];
  pending: boolean;
  highlightedSourceId: string | null;
  selectedSourceIds: string[];
  setGoalField: <K extends "goal_type" | "risk_tolerance" | "latency_priority" | "accuracy_priority">(
    key: K,
    value: AgentGoal[K],
  ) => void;
  resetGoal: () => void;
  toggleChartSource: (id: string) => void;
  executeRequest: (opts?: { prompt?: string; tool_type?: ToolType }) => Promise<{ ok: boolean; reason?: string; response?: ExecuteResponse }>;
  clearTelemetry: () => void;
  lastTransactionId: string | null;
}

export function useRplStore(): RplStore {
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState<AgentGoal>(defaultGoal());
  const events = useTelemetry();
  const [highlightedSourceId, setHighlighted] = useState<string | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  const seedRef = useRef(false);

  const serversQuery = useQuery(serversQueryOptions());
  const sources = useMemo(() => serversQuery.data ?? [], [serversQuery.data]);

  // Seed chart selection with the first 3 sources once they arrive.
  useEffect(() => {
    if (!seedRef.current && sources.length > 0) {
      setSelectedSourceIds(sources.slice(0, Math.min(3, sources.length)).map((s) => s.source_id));
      seedRef.current = true;
    }
  }, [sources]);

  const setGoalField = useCallback<RplStore["setGoalField"]>((key, value) => {
    setGoal((prev) => {
      const next = { ...prev, [key]: value } as AgentGoal;
      next.derived_weights = deriveWeights({
        risk_tolerance: next.risk_tolerance as RiskLevel,
        accuracy_priority: next.accuracy_priority as PriorityLevel,
        latency_priority: next.latency_priority as PriorityLevel,
      });
      return next;
    });
  }, []);

  const resetGoal = useCallback(() => setGoal(defaultGoal()), []);
  const clearTelemetry = useCallback(() => telemetryStore.clear(), []);

  const toggleChartSource = useCallback((id: string) => {
    setSelectedSourceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const executeMutation = useMutation({
    mutationFn: (input: { prompt: string; tool_type: ToolType; goal: AgentGoal }) =>
      executeAgent({
        prompt: input.prompt,
        tool_type: input.tool_type,
        goal: goalToPayload(input.goal),
      }),
    onSuccess: (response, variables) => {
      // Append to local telemetry ring buffer.
      const chosen = sources.find((s) => s.source_id === response.server_id);
      const policy = chosen ? computePolicyScore(chosen, variables.goal.derived_weights) : 0;
      const event: TelemetryEvent = {
        id: response.transaction_id,
        timestamp: Date.now(),
        goal: variables.goal,
        chosen_source_id: response.server_id,
        policy_score: policy,
        outcome: response.outcome_status === "SUCCESS" ? "SUCCESS" : "ERROR",
        latency_sec: response.latency_sec,
        relevance: response.client_satisfaction,
        prev_reputation: chosen?.base_reputation ?? response.new_reputation_score,
        new_reputation: response.new_reputation_score,
      };
      telemetryStore.push(event);
      setLastTransactionId(response.transaction_id);
      setHighlighted(response.server_id);
      window.setTimeout(() => setHighlighted(null), 1400);
      setSelectedSourceIds((prev) =>
        prev.includes(response.server_id) ? prev : [...prev, response.server_id],
      );
      // Force the dashboard to refetch so reputation chart picks up the new score immediately.
      queryClient.invalidateQueries({ queryKey: SERVERS_QUERY_KEY });
    },
  });

  const executeRequest = useCallback<RplStore["executeRequest"]>(
    async (opts) => {
      if (executeMutation.isPending) return { ok: false, reason: "Request already in flight" };
      if (sources.length === 0) return { ok: false, reason: "No data sources available yet" };

      // Default tool_type derived from the source the policy would currently pick.
      const fallback = pickPreferredToolType(sources, goal);
      const tool_type = opts?.tool_type ?? fallback;
      const prompt = opts?.prompt ?? `Run a ${tool_type.toLowerCase().replace("_", " ")} task`;

      try {
        const response = await executeMutation.mutateAsync({ prompt, tool_type, goal });
        return { ok: true, response };
      } catch (err) {
        const reason = err instanceof ApiError ? err.message : "Unknown execution error";
        return { ok: false, reason };
      }
    },
    [executeMutation, sources, goal],
  );

  return useMemo(
    () => ({
      goal,
      setGoal,
      sources,
      isLoadingSources: serversQuery.isPending,
      isFetchingSources: serversQuery.isFetching,
      sourcesError: serversQuery.error instanceof ApiError ? serversQuery.error : null,
      refetchSources: () => {
        queryClient.invalidateQueries({ queryKey: SERVERS_QUERY_KEY });
      },
      events,
      pending: executeMutation.isPending,
      highlightedSourceId,
      selectedSourceIds,
      setGoalField,
      resetGoal,
      toggleChartSource,
      executeRequest,
      clearTelemetry,
      lastTransactionId,
    }),
    [
      goal,
      sources,
      serversQuery.isPending,
      serversQuery.isFetching,
      serversQuery.error,
      events,
      executeMutation.isPending,
      highlightedSourceId,
      selectedSourceIds,
      setGoalField,
      resetGoal,
      toggleChartSource,
      executeRequest,
      clearTelemetry,
      lastTransactionId,
      queryClient,
    ],
  );
}

function pickPreferredToolType(sources: DataSource[], goal: AgentGoal): ToolType {
  // Choose the highest-policy-score source's tool_type as the default execute target.
  let best: { source: DataSource; score: number } | null = null;
  for (const s of sources) {
    const score = computePolicyScore(s, goal.derived_weights);
    if (!best || score > best.score) best = { source: s, score };
  }
  const tag = best?.source.tool_type;
  if (tag) return tag as ToolType;
  // Fallback by tag.
  switch (best?.source.tag) {
    case "compute":
      return "MATH_COMPUTE";
    case "web":
      return "WEB_SEARCH";
    case "financial":
      return "FINANCIAL_DATA";
    case "research":
      return "RESEARCH_DB";
    case "news":
      return "NEWS_FEED";
    default:
      return "GENERAL";
  }
}
