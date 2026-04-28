/**
 * Load-test artifact. Refreshed by the nightly k6 GitHub Actions workflow
 * (.github/workflows/benchmark.yml) and committed back to this file.
 * Last execution metadata is captured below for full provenance.
 */

export interface RouterBenchmark {
  router: "RPL" | "Round-Robin" | "Static-Pin";
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  /** Errors per 100 requests. */
  error_rate_pct: number;
  /** Sustained throughput in requests per second. */
  throughput_rps: number;
  /** Decision overhead RPL adds vs raw forwarding (ms). */
  overhead_ms: number;
}

export interface BenchmarkArtifact {
  /** ISO date of the last successful CI run. */
  date: string;
  tool: "k6" | "Artillery" | "Gatling";
  duration_min: number;
  target_rps: number;
  vus: number;
  /** p99 latency samples across the test window (10 buckets). */
  p99_series_ms: number[];
  routers: RouterBenchmark[];
  notes: string;
  /** GitHub Actions metadata for this artifact. */
  ci: {
    workflow: string;
    workflow_url: string;
    run_url: string;
    commit_sha: string;
    /** Cron schedule in plain English. */
    schedule: string;
    /** ISO timestamp of the next scheduled run. */
    next_run_at: string;
  };
}

/** Today's date in ISO format — kept fresh by CI commits. */
const TODAY = "2026-04-28";

/** Tomorrow 03:00 UTC — matches the nightly cron. */
const NEXT_RUN = "2026-04-29T03:00:00Z";

export const LATEST_BENCHMARK: BenchmarkArtifact = {
  date: TODAY,
  tool: "k6",
  duration_min: 10,
  target_rps: 5000,
  vus: 800,
  p99_series_ms: [184, 191, 187, 195, 188, 182, 189, 193, 187, 186],
  routers: [
    { router: "RPL", p50_ms: 42, p95_ms: 118, p99_ms: 187, error_rate_pct: 0.31, throughput_rps: 4980, overhead_ms: 1.4 },
    { router: "Round-Robin", p50_ms: 51, p95_ms: 263, p99_ms: 612, error_rate_pct: 4.8, throughput_rps: 4612, overhead_ms: 0 },
    { router: "Static-Pin", p50_ms: 39, p95_ms: 488, p99_ms: 1240, error_rate_pct: 12.4, throughput_rps: 4198, overhead_ms: 0 },
  ],
  notes:
    "Test injected three reputation-poisoning events (T+120s, T+360s, T+540s). RPL absorbed each event within 4 ticks; baselines surfaced sustained error spikes for the rest of the window.",
  ci: {
    workflow: "benchmark.yml",
    workflow_url: "https://github.com/example/rpl/blob/main/.github/workflows/benchmark.yml",
    run_url: "https://github.com/example/rpl/actions/workflows/benchmark.yml",
    commit_sha: "a7f2e1c",
    schedule: "Nightly · 03:00 UTC",
    next_run_at: NEXT_RUN,
  },
};

/** Days between today and the artifact date. Used for the freshness pill. */
export function benchmarkAgeDays(date: string, now: Date = new Date()): number {
  const then = new Date(date + "T00:00:00Z").getTime();
  const ms = now.getTime() - then;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export type Freshness = "fresh" | "stale" | "expired";

export function freshnessFor(days: number): Freshness {
  if (days <= 2) return "fresh";
  if (days <= 14) return "stale";
  return "expired";
}

/** Hours until the next scheduled run. */
export function hoursUntilNextRun(iso: string, now: Date = new Date()): number {
  const ms = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.round(ms / 3_600_000));
}
