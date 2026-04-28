import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, Cloud, Activity, Building2, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TENANTS, useTenant, setTenantId } from "@/lib/tenant-store";

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-northeast-1"] as const;
const ENVS = ["prod", "staging", "dev"] as const;

const BUILD_SHA = (typeof __APP_BUILD_SHA__ !== "undefined" ? __APP_BUILD_SHA__ : "")
  .slice(0, 7) || "rpl-dev";

declare const __APP_BUILD_SHA__: string;

interface Props {
  apiHealthy?: boolean;
  liveLabel?: string;
}

/**
 * Shared infra-grade top bar. Region/env switchers are visual only — they do
 * not change endpoints because the backend in this demo is single-region.
 */
export function AppHeader({ apiHealthy = true, liveLabel = "LIVE" }: Props) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tenant = useTenant();
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("us-east-1");
  const [env, setEnv] = useState<(typeof ENVS)[number]>("prod");
  const [uptime, setUptime] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function onTenantChange(id: string) {
    setTenantId(id);
    const t = TENANTS.find((x) => x.id === id);
    if (t) {
      toast.success(`Switched to ${t.label}`, {
        description: `IAM session re-tagged with PrincipalTag/tenant=${id} · DynamoDB LeadingKeys condition now isolates rows to this tenant.`,
      });
    }
  }

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setUptime(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-[0_0_18px_-2px_oklch(0.84_0.21_148/55%)]">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="leading-tight min-w-0">
            <h1 className="text-sm font-semibold tracking-tight truncate">
              RPL <span className="text-muted-foreground font-normal">·</span> Trust Console
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              MCP Reputation Policy · {BUILD_SHA}
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-0.5 rounded-lg border border-border bg-surface/60 p-1">
          <NavItem to="/" label="Console" active={path === "/"} />
          <NavItem to="/rpl" label="RPL" active={path === "/rpl"} />
          <NavItem to="/scenarios" label="Scenarios" active={path === "/scenarios"} />
          <NavItem to="/observability" label="Observe" active={path === "/observability"} />
          <NavItem to="/well-architected" label="WA" active={path === "/well-architected"} />
          <NavItem to="/architecture" label="Arch" active={path === "/architecture"} />
        </nav>

        <div className="flex items-center gap-1.5 shrink-0" suppressHydrationWarning>
          {mounted && (
            <>
              <Menu
                className="hidden xl:flex w-[10rem]"
                value={tenant.id}
                options={TENANTS.map((t) => ({ value: t.id, label: t.id }))}
                onChange={onTenantChange}
                ariaLabel="Active tenant"
                color={tenant.color}
                borderColor={`${tenant.color}55`}
                icon={<Building2 className="h-3 w-3 shrink-0" style={{ color: tenant.color }} />}
                title={`Active tenant — IAM PrincipalTag/tenant=${tenant.id}`}
              />
              <Menu
                className="hidden sm:flex w-[5.5rem]"
                value={env}
                options={ENVS.map((e) => ({ value: e, label: e }))}
                onChange={(v) => setEnv(v as (typeof ENVS)[number])}
                ariaLabel="Environment"
              />
              <Menu
                className="hidden md:flex w-[7rem]"
                value={region}
                options={REGIONS.map((r) => ({ value: r, label: r }))}
                onChange={(v) => setRegion(v as (typeof REGIONS)[number])}
                ariaLabel="AWS region"
              />
            </>
          )}
          <div className="hidden lg:flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-surface/60">
            <Cloud className="h-3 w-3 text-chart-4" />
            <span className="font-mono text-[10px] text-muted-foreground">aws</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-surface/60">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {fmtUptime(uptime)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-surface/60">
            <span
              className={`h-1.5 w-1.5 rounded-full animate-blink ${apiHealthy ? "bg-success" : "bg-danger"}`}
            />
            <span className={`font-mono text-[10px] ${apiHealthy ? "text-success" : "text-danger"}`}>
              {apiHealthy ? liveLabel : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>
      <div className="md:hidden border-t border-border/40 px-4 py-2 flex gap-1 overflow-x-auto">
        <NavItem to="/" label="Console" active={path === "/"} />
        <NavItem to="/rpl" label="RPL" active={path === "/rpl"} />
        <NavItem to="/scenarios" label="Scenarios" active={path === "/scenarios"} />
        <NavItem to="/architecture" label="Architecture" active={path === "/architecture"} />
      </div>
    </header>
  );
}

function NavItem({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${
        active
          ? "bg-success/15 text-success"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

interface MenuOption { value: string; label: string; }
interface MenuProps {
  value: string;
  options: MenuOption[];
  onChange: (v: string) => void;
  ariaLabel: string;
  className?: string;
  color?: string;
  borderColor?: string;
  icon?: React.ReactNode;
  title?: string;
}

/**
 * Extension-resistant select. Native <select> elements get rewritten by
 * style-injecting browser extensions (e.g. bb-customSelect), which causes
 * SSR/CSR hydration mismatches. This is a plain button + popover that
 * extensions ignore.
 */
function Menu({ value, options, onChange, ariaLabel, className, color, borderColor, icon, title }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative items-center ${className ?? ""}`} title={title}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-full flex items-center gap-1.5 rounded-md border bg-surface/60 px-2 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-ring hover:bg-accent/40 transition-colors"
        style={{ color: color ?? undefined, borderColor: borderColor ?? undefined }}
      >
        {icon}
        <span className="flex-1 text-left truncate">{current.label}</span>
        <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-full rounded-md border border-border bg-background/95 backdrop-blur-xl shadow-lg p-1"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                    active
                      ? "bg-success/15 text-success"
                      : "text-foreground/80 hover:bg-accent/40"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
