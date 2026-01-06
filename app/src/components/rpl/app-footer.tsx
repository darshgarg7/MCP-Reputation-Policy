import { Cloud } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mx-auto max-w-[1600px] px-4 sm:px-6 pb-8 mt-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-border/40">
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/70">
          <Cloud className="h-3 w-3" />
          <span>Deployed on AWS · us-east-1 · Built with Bedrock + Strands Agents</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/60">
          <span>Reputation Policy Layer for MCP</span>
          <span className="hidden sm:inline">·</span>
          <span>v1.0</span>
        </div>
      </div>
    </footer>
  );
}
