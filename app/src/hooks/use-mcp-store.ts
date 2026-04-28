import { useCallback, useState } from "react";
import { mockExecuteTask } from "@/lib/mock-api";
import {
  TRUST_THRESHOLD,
  type LogEntry,
  type ServerState,
  type ToolType,
} from "@/lib/mcp-types";

const INITIAL_SERVERS: ServerState[] = [
  { server_id: "compute_server_1", tool_type: "MATH_COMPUTE", score: 0.85, status: "TRUSTED", interactions: 12 },
  { server_id: "compute_server_4", tool_type: "MATH_COMPUTE", score: 0.7821, status: "TRUSTED", interactions: 27 },
  { server_id: "data_server_2", tool_type: "DATA_RETRIEVAL", score: 0.95, status: "TRUSTED", interactions: 42 },
  { server_id: "data_server_7", tool_type: "DATA_RETRIEVAL", score: 0.5412, status: "BLOCKED", interactions: 9 },
  { server_id: "image_cheap_5", tool_type: "IMAGE_GEN", score: 0.65, status: "BLOCKED", interactions: 4 },
  { server_id: "image_premium_8", tool_type: "IMAGE_GEN", score: 0.9123, status: "TRUSTED", interactions: 31 },
  { server_id: "reasoning_server_3", tool_type: "REASONING", score: 0.7634, status: "TRUSTED", interactions: 18 },
  { server_id: "reasoning_lite_6", tool_type: "REASONING", score: 0.4188, status: "BLOCKED", interactions: 11 },
  { server_id: "search_server_4", tool_type: "SEMANTIC_SEARCH", score: 0.8821, status: "TRUSTED", interactions: 56 },
];

export interface McpStore {
  servers: ServerState[];
  logs: LogEntry[];
  pending: boolean;
  lastUpdatedServerId: string | null;
  executeTask: (toolType: ToolType, prompt: string) => Promise<{ ok: boolean; reason?: string }>;
}

export function useMcpStore(): McpStore {
  const [servers, setServers] = useState<ServerState[]>(INITIAL_SERVERS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [lastUpdatedServerId, setLastUpdatedServerId] = useState<string | null>(null);

  const executeTask = useCallback<McpStore["executeTask"]>(
    async (toolType, prompt) => {
      if (pending) return { ok: false, reason: "Another task is in flight" };
      setPending(true);
      try {
        const snapshot = servers;
        const res = await mockExecuteTask({ tool_type: toolType, prompt, servers: snapshot });
        if (!res) {
          return { ok: false, reason: `No server available for ${toolType}` };
        }
        const target = snapshot.find((s) => s.server_id === res.server_id)!;
        const prev_score = target.score;

        setServers((prev) =>
          prev.map((s) =>
            s.server_id === res.server_id
              ? {
                  ...s,
                  score: res.new_score,
                  status: res.new_score >= TRUST_THRESHOLD ? "TRUSTED" : "BLOCKED",
                  interactions: s.interactions + 1,
                }
              : s,
          ),
        );

        setLogs((prev) =>
          [
            {
              ...res,
              id: `${res.server_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              tool_type: toolType,
              prompt,
              prev_score,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 50),
        );

        setLastUpdatedServerId(res.server_id);
        // Clear highlight marker shortly after so repeated hits re-trigger.
        window.setTimeout(() => setLastUpdatedServerId(null), 1300);

        return { ok: true };
      } finally {
        setPending(false);
      }
    },
    [pending, servers],
  );

  return { servers, logs, pending, lastUpdatedServerId, executeTask };
}
