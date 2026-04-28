import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TaskConsole } from "@/components/mcp/task-console";
import { TelemetryLog } from "@/components/mcp/telemetry-log";
import { ReputationGrid } from "@/components/mcp/reputation-grid";
import { useMcpStore } from "@/hooks/use-mcp-store";
import { AppHeader } from "@/components/rpl/app-header";
import { AppFooter } from "@/components/rpl/app-footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "MCP Agentic Routing & Reputation Protocol" },
      {
        name: "description",
        content:
          "Operator console for the MCP Agentic Routing & Reputation Protocol — route tasks, watch reputation update in real time.",
      },
      { property: "og:title", content: "MCP Agentic Routing & Reputation Protocol" },
      {
        property: "og:description",
        content:
          "Premium dark-mode dashboard for routing prompts to tool servers and auditing dynamic reputation scores.",
      },
    ],
  }),
});

function Index() {
  const { servers, logs, pending, lastUpdatedServerId, executeTask } = useMcpStore();

  // Force-dark theme + load fonts once.
  useEffect(() => {
    document.documentElement.classList.add("dark");
    if (!document.getElementById("mcp-fonts")) {
      const link = document.createElement("link");
      link.id = "mcp-fonts";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  async function handleExecute(toolType: Parameters<typeof executeTask>[0], prompt: string) {
    const res = await executeTask(toolType, prompt);
    if (!res.ok && res.reason) toast.error(res.reason);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" />

      <AppHeader />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 lg:py-8 grid gap-5 lg:grid-cols-12">
        {/* Left column: console + log */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
          <TaskConsole pending={pending} onExecute={handleExecute} />
          <TelemetryLog logs={logs} />
        </div>

        {/* Right column: reputation audit */}
        <div className="lg:col-span-7 xl:col-span-8">
          <ReputationGrid servers={servers} lastUpdatedServerId={lastUpdatedServerId} />
        </div>
      </div>

      <AppFooter />
    </main>
  );
}
