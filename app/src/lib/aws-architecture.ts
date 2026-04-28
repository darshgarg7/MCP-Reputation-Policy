/**
 * AWS architecture metadata for the /architecture page.
 * Pure data — diagram component renders nodes from this.
 */

export type ServiceLayer = "edge" | "compute" | "agent" | "state" | "stream" | "observe" | "governance";

export interface AwsService {
  id: string;
  name: string;
  short: string;
  layer: ServiceLayer;
  /** SVG grid coords (col, row) on a 6×4 grid. */
  col: number;
  row: number;
  role: string;
  iam: string[];
  dataIn: string;
  dataOut: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

export const AWS_SERVICES: AwsService[] = [
  {
    id: "cloudfront",
    name: "Amazon CloudFront",
    short: "CDN · TLS termination",
    layer: "edge",
    col: 0,
    row: 1,
    role: "Global edge cache for the operator console + API. Terminates TLS, blocks geo-restricted regions, and strips headers before origin forwarding.",
    iam: ["s3:GetObject (web origin)", "logs:PutLogEvents (real-time logs)"],
    dataIn: "User HTTPS requests",
    dataOut: "Cached static assets · Forwarded API calls",
  },
  {
    id: "apigateway",
    name: "API Gateway (HTTP API)",
    short: "Authn · throttling · routing",
    layer: "edge",
    col: 1,
    row: 1,
    role: "Authenticates calls (JWT via Cognito), enforces per-tenant rate limits, and routes /servers + /execute to the FastAPI service on Fargate.",
    iam: ["execute-api:Invoke", "cognito-idp:GetUser"],
    dataIn: "Validated requests from CloudFront",
    dataOut: "Routed requests to ECS",
  },
  {
    id: "ecs",
    name: "ECS Fargate · FastAPI",
    short: "Policy engine · routing",
    layer: "compute",
    col: 2,
    row: 1,
    role: "Stateless FastAPI workers. Reads reputation from ElastiCache, computes the policy score (α·rep + β·acc + γ·lat), invokes Bedrock, and writes telemetry to Kinesis.",
    iam: [
      "bedrock:InvokeModel",
      "dynamodb:GetItem · UpdateItem",
      "elasticache:Connect",
      "kinesis:PutRecord",
    ],
    dataIn: "Agent requests · goal config",
    dataOut: "Tool invocations · telemetry events",
  },
  {
    id: "lambda",
    name: "AWS Lambda · Decay Worker",
    short: "Temporal decay · cron",
    layer: "compute",
    col: 2,
    row: 2,
    role: "EventBridge-scheduled Lambda (every 30s) applies the exponential decay function to every reputation score and writes back to DynamoDB.",
    iam: ["dynamodb:Scan · BatchWriteItem", "logs:PutLogEvents"],
    dataIn: "EventBridge cron tick",
    dataOut: "Decayed reputation scores",
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    short: "Claude Sonnet · Nova",
    layer: "agent",
    col: 3,
    row: 1,
    role: "Hosts the foundation models the agent calls for tool-use planning and natural-language reasoning over results. Configured with cross-region inference for resilience.",
    iam: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    dataIn: "Prompts + tool schemas",
    dataOut: "Tool selections · reasoning",
  },
  {
    id: "strands",
    name: "Strands Agents SDK",
    short: "Tool-use loop",
    layer: "agent",
    col: 3,
    row: 2,
    role: "Open-source agent framework running inside the FastAPI service. Manages the tool-use loop, retries, and structured output parsing.",
    iam: ["(in-process · no IAM)"],
    dataIn: "Bedrock responses",
    dataOut: "Validated tool calls",
  },
  {
    id: "dynamodb",
    name: "Amazon DynamoDB",
    short: "Reputation store",
    layer: "state",
    col: 4,
    row: 1,
    role: "Single-table design keyed on (server_id, sk). Stores current reputation, status, history sketches, and per-tenant overrides. PITR enabled.",
    iam: ["dynamodb:GetItem · UpdateItem · Query"],
    dataIn: "Reputation updates · decay writes",
    dataOut: "Hot reads to Fargate / ElastiCache",
  },
  {
    id: "elasticache",
    name: "ElastiCache (Valkey)",
    short: "Hot scores · sub-ms",
    layer: "state",
    col: 4,
    row: 2,
    role: "Sub-millisecond cache for current reputation scores. Write-through from DynamoDB; TTL aligns with decay tick to prevent stale routing.",
    iam: ["elasticache:Connect"],
    dataIn: "Score writes (write-through)",
    dataOut: "Score reads to policy engine",
  },
  {
    id: "kinesis",
    name: "Kinesis Data Streams",
    short: "Telemetry pipe",
    layer: "stream",
    col: 5,
    row: 1,
    role: "Sharded stream of every routing decision. Consumed by Firehose for archival and by a Lambda for anomaly detection (poisoning signals).",
    iam: ["kinesis:PutRecord · DescribeStream"],
    dataIn: "Decision telemetry from Fargate",
    dataOut: "Firehose consumer · anomaly Lambda",
  },
  {
    id: "s3",
    name: "S3 · Telemetry Lake",
    short: "Parquet · Athena-queryable",
    layer: "stream",
    col: 5,
    row: 2,
    role: "Firehose lands 60s parquet batches partitioned by date/tenant. Athena + Glue Catalog enable ad-hoc forensic queries on any historical decision.",
    iam: ["s3:PutObject · GetObject", "glue:GetTable"],
    dataIn: "Firehose-delivered parquet",
    dataOut: "Athena queries · audit reports",
  },
  {
    id: "cloudwatch",
    name: "CloudWatch + X-Ray",
    short: "Metrics · traces · alarms",
    layer: "observe",
    col: 2,
    row: 0,
    role: "Centralised metrics (p95 latency, decision throughput, quarantine count), structured logs, distributed traces. Composite alarms page on-call when SLOs slip.",
    iam: ["cloudwatch:PutMetricData", "xray:PutTraceSegments", "logs:*"],
    dataIn: "Metrics · logs · trace segments",
    dataOut: "Alarms · dashboards",
  },
  // ---------------- Governance plane (row 3) ----------------
  {
    id: "cloudtrail",
    name: "AWS CloudTrail",
    short: "Audit · data events",
    layer: "governance",
    col: 1,
    row: 3,
    role: "Captures every control-plane API call and Bedrock InvokeModel data event. Logs are delivered to a write-once S3 bucket in a separate audit account with object lock.",
    iam: ["cloudtrail:LookupEvents", "s3:PutObject (audit account)"],
    dataIn: "AWS API activity · Bedrock data events",
    dataOut: "Immutable audit log to S3 (cross-account)",
  },
  {
    id: "kms",
    name: "AWS KMS",
    short: "CMKs · annual rotation",
    layer: "governance",
    col: 2,
    row: 3,
    role: "Customer-managed keys encrypt DynamoDB, S3 telemetry lake, ElastiCache snapshots, and Secrets Manager material. Annual rotation enabled; key policies pin usage to specific service principals.",
    iam: ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"],
    dataIn: "Encrypt/decrypt requests from data-plane services",
    dataOut: "Data keys · CloudTrail key-usage events",
  },
  {
    id: "vpc-endpoints",
    name: "VPC Endpoints",
    short: "PrivateLink · no public egress",
    layer: "governance",
    col: 3,
    row: 3,
    role: "Interface endpoints for Bedrock, DynamoDB, KMS, and Secrets Manager keep all service traffic inside the VPC. Endpoint policies restrict which actions and resources are reachable.",
    iam: ["ec2:DescribeVpcEndpoints (read-only)"],
    dataIn: "Service calls from Fargate task ENIs",
    dataOut: "Private routed traffic to AWS service endpoints",
  },
  {
    id: "aws-config",
    name: "AWS Config",
    short: "Drift · conformance packs",
    layer: "governance",
    col: 4,
    row: 3,
    role: "Continuously evaluates resource configurations against a Well-Architected conformance pack. Auto-remediates findings such as public S3 ACLs, unencrypted volumes, or missing CloudTrail.",
    iam: ["config:Put*", "ssm:StartAutomationExecution"],
    dataIn: "Resource configuration snapshots",
    dataOut: "Compliance findings · auto-remediation",
  },
];

export const FLOW_EDGES: FlowEdge[] = [
  { from: "cloudfront", to: "apigateway" },
  { from: "apigateway", to: "ecs" },
  { from: "ecs", to: "bedrock" },
  { from: "bedrock", to: "strands" },
  { from: "strands", to: "ecs" },
  { from: "ecs", to: "dynamodb" },
  { from: "ecs", to: "elasticache" },
  { from: "elasticache", to: "dynamodb" },
  { from: "lambda", to: "dynamodb" },
  { from: "ecs", to: "kinesis" },
  { from: "kinesis", to: "s3" },
  { from: "ecs", to: "cloudwatch" },
  { from: "lambda", to: "cloudwatch" },
];

/** Ordered path used by the "Trace a request" animation. */
export const TRACE_PATH: string[] = [
  "cloudfront",
  "apigateway",
  "ecs",
  "elasticache",
  "bedrock",
  "strands",
  "dynamodb",
  "kinesis",
];

export const LAYER_LABELS: Record<ServiceLayer, string> = {
  edge: "Edge",
  compute: "Compute",
  agent: "Agent layer",
  state: "State",
  stream: "Streaming",
  observe: "Observability",
  governance: "Governance",
};

export const LAYER_COLORS: Record<ServiceLayer, string> = {
  edge: "oklch(0.72 0.16 220)",
  compute: "oklch(0.84 0.21 148)",
  agent: "oklch(0.75 0.18 300)",
  state: "oklch(0.82 0.17 70)",
  stream: "oklch(0.80 0.16 200)",
  observe: "oklch(0.66 0.25 22)",
  governance: "oklch(0.62 0.04 250)",
};
