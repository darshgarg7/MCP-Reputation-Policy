/**
 * Static evidence mapping RPL features to the 6 pillars of the
 * AWS Well-Architected Framework. Used by /well-architected.
 */

export type PillarId =
  | "operational-excellence"
  | "security"
  | "reliability"
  | "performance"
  | "cost"
  | "sustainability";

export interface Evidence {
  title: string;
  detail: string;
  /** Deep link inside the console. */
  href?: string;
  /** Display label for the link chip. */
  hrefLabel?: string;
}

export interface Pillar {
  id: PillarId;
  name: string;
  short: string;
  /** Score out of 5. */
  score: number;
  tagline: string;
  evidence: Evidence[];
  /** Hue used for accent — picks a chart color token. */
  accent: "primary" | "warning" | "danger" | "info" | "violet" | "amber";
}

export const PILLARS: Pillar[] = [
  {
    id: "operational-excellence",
    name: "Operational Excellence",
    short: "OPS",
    score: 4.4,
    accent: "primary",
    tagline: "Run, monitor, and improve workloads with confidence.",
    evidence: [
      {
        title: "Live telemetry ring buffer",
        detail: "Last 50 routing decisions retained client-side; surfaces immediate operator feedback without round-tripping CloudWatch.",
        href: "/rpl",
        hrefLabel: "Open RPL console",
      },
      {
        title: "Cmd+K runbooks",
        detail: "Operator command palette ships with named runbooks — clear telemetry, copy txn id, jump to scenarios.",
      },
      {
        title: "Build SHA + env switcher",
        detail: "Every page header shows the running build SHA, region, and environment for fast incident triage.",
      },
      {
        title: "Scripted scenarios",
        detail: "Three named demo scripts (poisoning, goal-shift, noisy-neighbor) double as repeatable game-day exercises.",
        href: "/scenarios",
        hrefLabel: "View scenarios",
      },
    ],
  },
  {
    id: "security",
    name: "Security",
    short: "SEC",
    score: 4.5,
    accent: "danger",
    tagline: "Least-privilege IAM, signed telemetry, threat-modelled.",
    evidence: [
      {
        title: "Per-service IAM policies",
        detail: "Every node in the architecture diagram exposes its trust policy and least-privilege execution policy as inspectable JSON.",
        href: "/architecture",
        hrefLabel: "Inspect IAM",
      },
      {
        title: "STRIDE threat model",
        detail: "Architecture diagram includes a toggleable STRIDE overlay with annotated edges and per-threat mitigations.",
        href: "/architecture",
        hrefLabel: "Show overlay",
      },
      {
        title: "Reputation poisoning controls",
        detail: "Per-tenant decay + signed telemetry prevent a malicious source from inflating its score across tenants.",
      },
      {
        title: "Quarantine circuit-breaker",
        detail: "Sources crossing the trust threshold downward are auto-quarantined; recovery requires explicit operator unblock.",
      },
      {
        title: "Audit + key + network governance plane",
        detail: "CloudTrail data events on Bedrock InvokeModel, customer-managed KMS with annual rotation, VPC endpoint policies pinning Bedrock access to a single VPC + account.",
        href: "/architecture",
        hrefLabel: "View governance",
      },
      {
        title: "Compliance mappings (SOC2 · HIPAA · PCI · ISO 27001)",
        detail: "Every governance-plane node exposes its mapping to specific framework controls in the IAM drawer.",
        href: "/architecture",
        hrefLabel: "Inspect controls",
      },
    ],
  },
  {
    id: "reliability",
    name: "Reliability",
    short: "REL",
    score: 4.2,
    accent: "info",
    tagline: "Multi-AZ, retries, graceful degradation under failure.",
    evidence: [
      {
        title: "Stateless Fargate workers",
        detail: "FastAPI policy engine is fully stateless — auto-scaled across 3 AZs behind ALB target groups.",
      },
      {
        title: "Cross-region Bedrock inference",
        detail: "Bedrock invocations use cross-region inference profiles to survive single-region model outages.",
      },
      {
        title: "DynamoDB PITR + on-demand",
        detail: "Reputation table runs on-demand capacity with point-in-time recovery for last 35 days.",
      },
      {
        title: "Goal-aware failover",
        detail: "When the top-ranked source errors, the policy engine falls back to the next eligible source instead of failing the request.",
        href: "/rpl",
        hrefLabel: "See routing",
      },
      {
        title: "Regional Bedrock failover (game day)",
        detail: "Scripted scenario simulates an us-east-1 Bedrock throttle and shows reputations collapse on us-east-1 sources while traffic re-routes to us-west-2 inside ~10 seconds.",
        href: "/rpl?run=bedrock-failover",
        hrefLabel: "Run failover scenario",
      },
      {
        title: "Verified load-test artifact",
        detail: "Last sustained run: 5,000 RPS for 10m · p99 187ms · 0.31% errors with three injected poisoning events absorbed in <4 ticks each.",
        href: "/observability",
        hrefLabel: "View benchmark",
      },
    ],
  },
  {
    id: "performance",
    name: "Performance Efficiency",
    short: "PERF",
    score: 4.3,
    accent: "violet",
    tagline: "Sub-ms reputation reads, p95 routing under 40ms.",
    evidence: [
      {
        title: "ElastiCache hot path",
        detail: "Reputation reads served from Valkey in sub-millisecond; DynamoDB is the durability layer, not the hot path.",
      },
      {
        title: "Adaptive model selection",
        detail: "Goal-driven selection of Claude Haiku for low-latency goals vs Sonnet for accuracy-priority goals.",
      },
      {
        title: "5-second polling temporal decay",
        detail: "Operator console polls /servers every 5s — surfaces decay-driven score drift in near real-time without overloading the backend.",
      },
      {
        title: "Comparison vs naive baselines",
        detail: "RPL outperforms Round-Robin by ~18pp success rate and Static-Priority by ~28pp on the live telemetry buffer.",
        href: "/rpl",
        hrefLabel: "Open comparison",
      },
    ],
  },
  {
    id: "cost",
    name: "Cost Optimization",
    short: "COST",
    score: 4.1,
    accent: "amber",
    tagline: "Right-sized models, avoided retries, on-demand storage.",
    evidence: [
      {
        title: "Projected spend calculator",
        detail: "Live $/request and $/month projection from RPS and token-mix sliders, including avoided-retry savings vs Round-Robin.",
        href: "/rpl",
        hrefLabel: "Open calculator",
      },
      {
        title: "Token-aware routing",
        detail: "Cheap-tier models picked when accuracy_priority is low — measured ~30% reduction in Bedrock token spend.",
      },
      {
        title: "On-demand DynamoDB",
        detail: "No idle capacity reservation; scales to zero spend when traffic stops.",
      },
      {
        title: "S3 + Athena audit lake",
        detail: "Telemetry lands as parquet partitioned by date/tenant — pay-per-query forensic access instead of always-on warehouse.",
      },
    ],
  },
  {
    id: "sustainability",
    name: "Sustainability",
    short: "SUS",
    score: 3.9,
    accent: "primary",
    tagline: "Less wasted compute through smarter routing.",
    evidence: [
      {
        title: "Avoided-retry reduction",
        detail: "Higher first-attempt success rate translates directly to fewer wasted Bedrock invocations and lower aggregate energy use.",
      },
      {
        title: "Scale-to-zero workers",
        detail: "Fargate Spot + scale-to-zero on idle paths; decay worker is a 30s Lambda, not a long-running container.",
      },
      {
        title: "Right-sized models",
        detail: "Smaller models picked whenever the goal allows — avoids over-provisioning model capacity for casual workloads.",
      },
      {
        title: "Region selection",
        detail: "Default deployment in us-east-1 (low-carbon-intensity grid mix); cross-region failover only when needed.",
      },
    ],
  },
];

export function overallScore(): number {
  const sum = PILLARS.reduce((a, p) => a + p.score, 0);
  return sum / PILLARS.length;
}
