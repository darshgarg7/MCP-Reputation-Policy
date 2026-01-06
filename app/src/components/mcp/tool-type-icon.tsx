import { Brain, Calculator, Database, ImageIcon, Search } from "lucide-react";
import type { ToolType } from "@/lib/mcp-types";

const MAP = {
  MATH_COMPUTE: Calculator,
  DATA_RETRIEVAL: Database,
  REASONING: Brain,
  IMAGE_GEN: ImageIcon,
  SEMANTIC_SEARCH: Search,
} as const;

export function ToolTypeIcon({
  type,
  className,
  size = 16,
}: {
  type: ToolType;
  className?: string;
  size?: number;
}) {
  const Icon = MAP[type];
  return <Icon className={className} size={size} strokeWidth={2} />;
}

export const TOOL_LABELS: Record<ToolType, string> = {
  MATH_COMPUTE: "Math",
  DATA_RETRIEVAL: "Data",
  REASONING: "Reasoning",
  IMAGE_GEN: "Image",
  SEMANTIC_SEARCH: "Search",
};
