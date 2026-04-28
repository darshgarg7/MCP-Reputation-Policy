import { useMemo, useState } from "react";
import { Copy, Check, ShieldCheck, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { IAM_BY_SERVICE } from "@/lib/iam-policies";
import { complianceFor } from "@/lib/compliance-mappings";
import { useTenant } from "@/lib/tenant-store";

interface Props {
  serviceId: string;
}

type Tab = "trust" | "execution" | "assume";

export function IamDrawer({ serviceId }: Props) {
  const set = IAM_BY_SERVICE[serviceId];
  const tenant = useTenant();
  const [tab, setTab] = useState<Tab>("trust");
  const [copied, setCopied] = useState(false);

  const docJson = useMemo(() => {
    const doc = set ? (tab === "trust" ? set.trust : tab === "execution" ? set.execution : set.assumeRole) : null;
    return doc ? JSON.stringify(doc, null, 2) : null;
  }, [set, tab]);

  const referencesPrincipalTag = useMemo(
    () => !!docJson && docJson.includes("aws:PrincipalTag/tenant"),
    [docJson],
  );

  if (!set) {
    return (
      <p className="text-[11px] text-muted-foreground font-mono">
        No IAM model defined for this service.
      </p>
    );
  }

  const doc = tab === "trust" ? set.trust : tab === "execution" ? set.execution : set.assumeRole;
  const tabs: { id: Tab; label: string; available: boolean }[] = [
    { id: "trust", label: "Trust", available: true },
    { id: "execution", label: "Execution", available: true },
    { id: "assume", label: "AssumeRole", available: !!set.assumeRole },
  ];

  function copy() {
    if (!doc) return;
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            disabled={!t.available}
            onClick={() => setTab(t.id)}
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-success text-foreground/95"
                : "border-transparent text-muted-foreground hover:text-foreground/80",
              !t.available && "opacity-30 cursor-not-allowed",
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={copy}
            disabled={!doc}
            className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 disabled:opacity-30"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      <pre className="text-[10px] font-mono leading-relaxed text-foreground/85 bg-background/60 border border-border rounded-lg p-3 overflow-auto max-h-[260px]">
        {doc ? formatJson(doc) : "// not applicable"}
      </pre>

      {referencesPrincipalTag && (
        <div
          className="mt-2 rounded-md border p-2.5 flex items-start gap-2"
          style={{ borderColor: `${tenant.color}55`, backgroundColor: `${tenant.color}0F` }}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: tenant.color }} />
          <div className="text-[10px] leading-relaxed text-foreground/80">
            <span className="font-mono uppercase tracking-wider mr-1" style={{ color: tenant.color }}>
              ${"{aws:PrincipalTag/tenant}"}
            </span>
            resolves to{" "}
            <span className="font-mono font-semibold" style={{ color: tenant.color }}>
              {tenant.id}
            </span>{" "}
            for this session — DynamoDB <code className="font-mono">LeadingKeys</code> condition
            isolates rows to <span className="font-mono">{tenant.id}/*</span>. Switch tenant in the
            header to see the policy bind to a different namespace.
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{set.notes}</p>

      <ComplianceChips serviceId={serviceId} />
    </div>
  );
}

function ComplianceChips({ serviceId }: { serviceId: string }) {
  const items = complianceFor(serviceId);
  if (items.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 mb-1.5">
        <ShieldCheck className="h-3 w-3 text-chart-4" />
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Compliance mapping
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((m, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-chart-4/15 text-chart-4 shrink-0">
              {m.framework} · {m.control}
            </span>
            <span className="text-[10px] text-foreground/75 leading-relaxed">{m.evidence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lightweight JSON formatter with token-class spans for keys/strings/numbers. */
function formatJson(value: unknown): React.ReactNode {
  const text = JSON.stringify(value, null, 2);
  // Tokenize: keys, strings, numbers, booleans/null.
  const parts: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<span key={i++} className="text-chart-4">{m[1]}</span>);
    else if (m[2]) parts.push(<span key={i++} className="text-success">{m[2]}</span>);
    else if (m[3]) parts.push(<span key={i++} className="text-chart-5">{m[3]}</span>);
    else if (m[4]) parts.push(<span key={i++} className="text-warning">{m[4]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
