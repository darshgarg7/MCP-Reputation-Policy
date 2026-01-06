/**
 * STRIDE threat-model overlay data for /architecture.
 */

export type Stride = "S" | "T" | "R" | "I" | "D" | "E";

export const STRIDE_LABELS: Record<Stride, string> = {
  S: "Spoofing",
  T: "Tampering",
  R: "Repudiation",
  I: "Information disclosure",
  D: "Denial of service",
  E: "Elevation of privilege",
};

export const STRIDE_COLORS: Record<Stride, string> = {
  S: "oklch(0.72 0.16 220)",
  T: "oklch(0.66 0.25 22)",
  R: "oklch(0.75 0.18 300)",
  I: "oklch(0.82 0.17 70)",
  D: "oklch(0.66 0.25 22)",
  E: "oklch(0.66 0.25 22)",
};

export interface ThreatEdge {
  from: string;
  to: string;
  stride: Stride[];
}

export const THREAT_EDGES: ThreatEdge[] = [
  { from: "cloudfront", to: "apigateway", stride: ["S", "D"] },
  { from: "apigateway", to: "ecs", stride: ["S", "E"] },
  { from: "ecs", to: "bedrock", stride: ["T", "I"] },
  { from: "ecs", to: "dynamodb", stride: ["T", "R"] },
  { from: "ecs", to: "kinesis", stride: ["T", "R"] },
  { from: "lambda", to: "dynamodb", stride: ["T"] },
];

export interface Threat {
  id: string;
  name: string;
  stride: Stride;
  asset: string;
  mitigation: string;
}

export const THREATS: Threat[] = [
  {
    id: "T1",
    name: "Reputation poisoning",
    stride: "T",
    asset: "DynamoDB rpl-reputation",
    mitigation: "Per-tenant decay + signed telemetry; cross-tenant writes blocked by IAM LeadingKeys condition.",
  },
  {
    id: "T2",
    name: "Token replay against API",
    stride: "S",
    asset: "API Gateway → ECS",
    mitigation: "JWT short-lived (5m) + replay cache in ElastiCache keyed on jti; refresh token rotation.",
  },
  {
    id: "T3",
    name: "Bedrock prompt-injection exfil",
    stride: "I",
    asset: "Bedrock invocations",
    mitigation: "Default Bedrock guardrail attached at service-role level; output filter strips secrets-shaped tokens before return.",
  },
  {
    id: "T4",
    name: "Telemetry tampering",
    stride: "T",
    asset: "Kinesis → S3 lake",
    mitigation: "HMAC signature per record using a worker-only KMS key; consumer rejects unsigned records.",
  },
  {
    id: "T5",
    name: "Decay worker over-write",
    stride: "E",
    asset: "Reputation table writes",
    mitigation: "Decay Lambda role can only BatchWriteItem with conditional updates that bound the delta per tick.",
  },
  {
    id: "T6",
    name: "Audit-log repudiation",
    stride: "R",
    asset: "CloudTrail + telemetry lake",
    mitigation: "CloudTrail Lake with object-lock; S3 telemetry bucket has versioning + MFA-delete for prod.",
  },
  {
    id: "T7",
    name: "Volumetric DDoS at edge",
    stride: "D",
    asset: "CloudFront / API Gateway",
    mitigation: "AWS Shield Advanced + WAF rate-based rule (1000 req/5min/IP) + per-tenant API GW throttle.",
  },
];

/** Trust boundaries drawn as bounding boxes around groups of nodes. */
export interface TrustBoundary {
  id: string;
  label: string;
  nodes: string[];
  color: string;
}

export const TRUST_BOUNDARIES: TrustBoundary[] = [
  {
    id: "internet",
    label: "Public internet",
    nodes: ["cloudfront"],
    color: "oklch(0.66 0.25 22)",
  },
  {
    id: "vpc",
    label: "VPC · private subnets",
    nodes: ["ecs", "lambda", "elasticache", "dynamodb", "kinesis", "s3"],
    color: "oklch(0.84 0.21 148)",
  },
  {
    id: "shared",
    label: "AWS-managed control plane",
    nodes: ["apigateway", "bedrock", "strands", "cloudwatch"],
    color: "oklch(0.72 0.16 220)",
  },
];
