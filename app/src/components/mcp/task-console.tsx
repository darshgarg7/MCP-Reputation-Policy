import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TOOL_TYPES, type ToolType } from "@/lib/mcp-types";
import { TOOL_LABELS, ToolTypeIcon } from "./tool-type-icon";
import { cn } from "@/lib/utils";

interface Props {
  pending: boolean;
  onExecute: (toolType: ToolType, prompt: string) => void;
}

const PLACEHOLDER: Record<ToolType, string> = {
  MATH_COMPUTE: "> Calculate the determinant of a 3x3 matrix...",
  DATA_RETRIEVAL: "> Fetch the latest 50 transactions from the ledger...",
  REASONING: "> Plan a 3-step strategy to reduce inference costs...",
  IMAGE_GEN: "> Generate a cyberpunk skyline at dusk...",
  SEMANTIC_SEARCH: "> Find documents about reputation decay algorithms...",
};

export function TaskConsole({ pending, onExecute }: Props) {
  const [tool, setTool] = useState<ToolType>("MATH_COMPUTE");
  const [prompt, setPrompt] = useState("");

  const disabled = pending || prompt.trim().length === 0;

  function submit() {
    if (disabled) return;
    onExecute(tool, prompt.trim());
    setPrompt("");
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Task Execution Console
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Route a prompt through the agent to a tool-providing server.
          </p>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
          /api/execute
        </span>
      </header>

      {/* Tool type selector */}
      <div role="radiogroup" aria-label="Tool type" className="flex flex-wrap gap-2 mb-4">
        {TOOL_TYPES.map((t) => {
          const active = t === tool;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTool(t)}
              className={cn(
                "group inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-success/60 bg-success/10 text-success glow-success"
                  : "border-border bg-surface hover:bg-accent text-muted-foreground hover:text-foreground",
              )}
            >
              <ToolTypeIcon type={t} size={14} />
              <span className="font-mono tracking-tight">{TOOL_LABELS[t]}</span>
            </button>
          );
        })}
      </div>

      {/* Prompt textarea */}
      <div className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder={PLACEHOLDER[tool]}
          rows={4}
          className="font-mono text-sm bg-surface/60 border-border resize-none placeholder:text-muted-foreground/60"
        />
        <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60 font-mono pointer-events-none">
          ⌘ + ↵
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-[11px] font-mono text-muted-foreground truncate">
          target: <span className="text-foreground/80">{tool}</span>
        </div>
        <Button
          onClick={submit}
          disabled={disabled}
          className={cn(
            "h-10 px-5 font-medium relative overflow-hidden",
            "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground",
            "hover:opacity-95 transition-all duration-200",
            "shadow-[0_0_24px_-6px_oklch(0.84_0.21_148/55%)] hover:shadow-[0_0_32px_-4px_oklch(0.84_0.21_148/70%)]",
            "disabled:opacity-50 disabled:shadow-none",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Routing…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Execute via Agent
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
