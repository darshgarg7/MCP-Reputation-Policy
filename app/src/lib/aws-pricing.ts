/**
 * Static AWS list pricing (us-east-1) used by the cost calculator.
 * All values are USD. Sourced from public AWS pricing pages, list price.
 * Update PRICING_AS_OF when refreshing.
 */

export const PRICING_AS_OF = "2026-04 · us-east-1 · list price";

export interface BedrockModel {
  id: string;
  label: string;
  /** USD per 1K input tokens. */
  inputPer1K: number;
  /** USD per 1K output tokens. */
  outputPer1K: number;
}

export const BEDROCK_MODELS: BedrockModel[] = [
  { id: "claude-sonnet", label: "Claude 3.5 Sonnet", inputPer1K: 0.003, outputPer1K: 0.015 },
  { id: "claude-haiku", label: "Claude 3.5 Haiku", inputPer1K: 0.0008, outputPer1K: 0.004 },
  { id: "llama-70b", label: "Llama 3.1 70B Instruct", inputPer1K: 0.00099, outputPer1K: 0.00099 },
  { id: "nova-lite", label: "Amazon Nova Lite", inputPer1K: 0.00006, outputPer1K: 0.00024 },
];

/** DynamoDB on-demand: per million request units. */
export const DDB_RRU_PER_MILLION = 0.125; // read request units
export const DDB_WRU_PER_MILLION = 0.625; // write request units

/** Kinesis Data Streams on-demand: per million PUT payload units (25KB each). */
export const KINESIS_PUT_PER_MILLION = 0.04;

/** ECS Fargate per vCPU-hour and per GB-hour. */
export const FARGATE_VCPU_HOUR = 0.04048;
export const FARGATE_GB_HOUR = 0.004445;

/**
 * Per-request cost breakdown given workload assumptions.
 * Assumes each request:
 *   - performs 1 Bedrock invocation with the given token mix
 *   - 1 DDB read (reputation lookup) + 0.3 DDB writes (avg)
 *   - 1 Kinesis PUT
 *   - amortized 0.0008 vCPU-hour share of Fargate runtime
 */
export interface CostInputs {
  rps: number;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  /** Avg avoided-retry rate vs baseline (e.g. 0.18 = 18% fewer requests needed). */
  avoidedRetryRate: number;
}

export interface CostBreakdown {
  bedrock: number;
  dynamodb: number;
  kinesis: number;
  fargate: number;
  totalPerRequest: number;
  perMonth: number;
  perMonthRoundRobin: number;
  monthlySavings: number;
}

const SECONDS_PER_MONTH = 60 * 60 * 24 * 30;

export function computeCost(input: CostInputs): CostBreakdown {
  const model = BEDROCK_MODELS.find((m) => m.id === input.modelId) ?? BEDROCK_MODELS[0];
  const bedrock =
    (input.inputTokens / 1000) * model.inputPer1K +
    (input.outputTokens / 1000) * model.outputPer1K;

  const ddb = DDB_RRU_PER_MILLION / 1_000_000 + (0.3 * DDB_WRU_PER_MILLION) / 1_000_000;
  const kinesis = KINESIS_PUT_PER_MILLION / 1_000_000;

  // 0.0008 vCPU-hour and 0.0016 GB-hour share per request (amortized 0.25 vCPU / 0.5 GB worker
  // handling ~300 req/s).
  const fargate = 0.0008 * FARGATE_VCPU_HOUR + 0.0016 * FARGATE_GB_HOUR;

  const totalPerRequest = bedrock + ddb + kinesis + fargate;
  const perMonth = totalPerRequest * input.rps * SECONDS_PER_MONTH;

  // Round-Robin baseline retries failed requests at the avoided-retry rate.
  const baselineMultiplier = 1 / Math.max(0.5, 1 - input.avoidedRetryRate);
  const perMonthRoundRobin = perMonth * baselineMultiplier;
  const monthlySavings = perMonthRoundRobin - perMonth;

  return {
    bedrock,
    dynamodb: ddb,
    kinesis,
    fargate,
    totalPerRequest,
    perMonth,
    perMonthRoundRobin,
    monthlySavings,
  };
}

export function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(6)}`;
}

/**
 * FinOps unit economics — the language CFOs use.
 * All inputs are observable from the live telemetry + cost projection.
 */
export interface UnitEconInputs {
  monthlyCost: number;
  monthlySavings: number;
  monthlyRequests: number;
  successRate: number;
  /** Avg avoided-retry rate (0..1). */
  avoidedRetryRate: number;
  /** Operator-tunable: assumed revenue per successful decision (USD). */
  revenuePerSuccess: number;
  /** Operator-tunable: avg "incident size" — how many requests one avoided incident represents. */
  incidentSize?: number;
}

export interface UnitEconomics {
  costPerSuccess: number;
  costPerAvoidedIncident: number;
  blendedCogsPct: number;
  grossMarginPct: number;
  monthlyRevenue: number;
}

export function computeUnitEconomics(input: UnitEconInputs): UnitEconomics {
  const successes = Math.max(1, input.monthlyRequests * input.successRate);
  const incidentSize = input.incidentSize ?? 250;
  const avoidedIncidents = Math.max(
    1,
    (input.avoidedRetryRate * input.monthlyRequests) / incidentSize,
  );
  const monthlyRevenue = successes * input.revenuePerSuccess;

  return {
    costPerSuccess: input.monthlyCost / successes,
    costPerAvoidedIncident: input.monthlySavings / avoidedIncidents,
    blendedCogsPct: monthlyRevenue > 0 ? (input.monthlyCost / monthlyRevenue) * 100 : 0,
    grossMarginPct: monthlyRevenue > 0 ? ((monthlyRevenue - input.monthlyCost) / monthlyRevenue) * 100 : 0,
    monthlyRevenue,
  };
}

