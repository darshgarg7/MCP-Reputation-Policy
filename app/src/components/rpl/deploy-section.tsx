import { useState } from "react";
import { Copy, Check, Rocket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CDK_SNIPPET, TF_SNIPPET, CLI_SNIPPET, BOOTSTRAP_CMD } from "@/lib/deploy-snippets";

type Tab = "cdk" | "terraform" | "cli";

const TABS: { id: Tab; label: string; lang: string; body: string }[] = [
  { id: "cdk", label: "AWS CDK · TypeScript", lang: "ts", body: CDK_SNIPPET },
  { id: "terraform", label: "Terraform · HCL", lang: "hcl", body: TF_SNIPPET },
  { id: "cli", label: "CloudFormation CLI", lang: "sh", body: CLI_SNIPPET },
];

export function DeploySection() {
  const [tab, setTab] = useState<Tab>("cdk");
  const [copied, setCopied] = useState(false);
  const active = TABS.find((t) => t.id === tab)!;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <header className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
            Deploy this stack
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
            · IaC · ready to fork
          </span>
        </div>
        <button
          onClick={() => copy(BOOTSTRAP_CMD, "Bootstrap command")}
          className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/15 transition-colors"
        >
          <Rocket className="h-3 w-3" /> Deploy to your account
        </button>
      </header>

      <div className="flex items-center gap-1 mb-3 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-success text-foreground/95"
                : "border-transparent text-muted-foreground hover:text-foreground/80",
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => copy(active.body, active.label)}
            className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      <pre className="text-[11px] font-mono leading-relaxed text-foreground/85 bg-background/60 border border-border rounded-lg p-4 overflow-auto max-h-[420px]">
        {colorize(active.body, active.lang)}
      </pre>
    </section>
  );
}

/** Lightweight token highlighter for CDK/HCL/CLI snippets. */
function colorize(src: string, lang: string): React.ReactNode {
  const lines = src.split("\n");
  const keywords =
    lang === "ts"
      ? /\b(import|from|export|class|new|const|let|var|return|extends|public|private|protected|async|await|if|else|true|false|null|undefined)\b/g
      : lang === "hcl"
      ? /\b(resource|provider|terraform|required_providers|module|variable|output|data|locals|true|false|null)\b/g
      : /\b(aws|cloudformation|deploy|true|false)\b/g;

  return lines.map((line, idx) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    // Comments first.
    const commentStart = line.search(lang === "hcl" || lang === "sh" ? /(^|\s)#/ : /\/\//);
    const code = commentStart >= 0 ? line.slice(0, commentStart) : line;
    const comment = commentStart >= 0 ? line.slice(commentStart) : "";

    // Strings.
    const strRe = /"[^"]*"|'[^']*'/g;
    const tokens: { start: number; end: number; node: React.ReactNode }[] = [];
    while ((m = strRe.exec(code))) {
      tokens.push({
        start: m.index,
        end: strRe.lastIndex,
        node: <span key={`s-${idx}-${i++}`} className="text-success">{m[0]}</span>,
      });
    }
    // Keywords.
    keywords.lastIndex = 0;
    while ((m = keywords.exec(code))) {
      // Skip if inside a string.
      if (tokens.some((t) => m!.index >= t.start && m!.index < t.end)) continue;
      tokens.push({
        start: m.index,
        end: keywords.lastIndex,
        node: <span key={`k-${idx}-${i++}`} className="text-chart-4">{m[0]}</span>,
      });
    }
    tokens.sort((a, b) => a.start - b.start);
    for (const t of tokens) {
      if (t.start > last) parts.push(code.slice(last, t.start));
      parts.push(t.node);
      last = t.end;
    }
    if (last < code.length) parts.push(code.slice(last));
    if (comment) parts.push(<span key={`c-${idx}`} className="text-muted-foreground">{comment}</span>);

    return (
      <div key={idx}>
        {parts.length === 0 ? "\u00a0" : parts}
      </div>
    );
  });
}
