/**
 * Per-service IAM trust + execution policies displayed in the
 * /architecture IAM drawer. Hand-authored to least privilege.
 */

export interface IamPolicySet {
  trust: object;
  execution: object;
  /** Optional cross-account assume-role example. */
  assumeRole?: object;
  /** Short prose explaining the model. */
  notes: string;
}

const TRUST_ECS_TASK = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "ecs-tasks.amazonaws.com" },
      Action: "sts:AssumeRole",
      Condition: {
        ArnLike: {
          "aws:SourceArn": "arn:aws:ecs:us-east-1:111122223333:cluster/rpl-prod",
        },
      },
    },
  ],
};

const TRUST_LAMBDA = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "lambda.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
};

const TRUST_APIGW = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "apigateway.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
};

const TRUST_BEDROCK = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "bedrock.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
};

export const IAM_BY_SERVICE: Record<string, IamPolicySet> = {
  cloudfront: {
    trust: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "cloudfront.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "ReadWebOrigin",
          Effect: "Allow",
          Action: ["s3:GetObject"],
          Resource: "arn:aws:s3:::rpl-console-web/*",
        },
        {
          Sid: "RealTimeLogs",
          Effect: "Allow",
          Action: ["logs:PutLogEvents"],
          Resource: "arn:aws:logs:us-east-1:111122223333:log-group:/aws/cloudfront/rpl:*",
        },
      ],
    },
    notes: "OAC-based read of the static origin bucket. No write permissions. Real-time logs scoped to a single log group.",
  },
  apigateway: {
    trust: TRUST_APIGW,
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "InvokeBackend",
          Effect: "Allow",
          Action: ["execute-api:Invoke"],
          Resource: "arn:aws:execute-api:us-east-1:111122223333:abc123/prod/*/servers",
        },
        {
          Sid: "VerifyJwt",
          Effect: "Allow",
          Action: ["cognito-idp:GetUser"],
          Resource: "arn:aws:cognito-idp:us-east-1:111122223333:userpool/us-east-1_RPL01",
        },
      ],
    },
    notes: "JWT authorizer validates tokens against a single Cognito user pool. No write permissions outside the API surface.",
  },
  ecs: {
    trust: TRUST_ECS_TASK,
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "BedrockInvokeOnly",
          Effect: "Allow",
          Action: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
          Resource: [
            "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*",
            "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-*",
          ],
        },
        {
          Sid: "ReputationStore",
          Effect: "Allow",
          Action: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"],
          Resource: "arn:aws:dynamodb:us-east-1:111122223333:table/rpl-reputation",
          Condition: {
            "ForAllValues:StringEquals": {
              "dynamodb:LeadingKeys": ["${aws:PrincipalTag/tenant}"],
            },
          },
        },
        {
          Sid: "TelemetryWrite",
          Effect: "Allow",
          Action: ["kinesis:PutRecord", "kinesis:PutRecords"],
          Resource: "arn:aws:kinesis:us-east-1:111122223333:stream/rpl-telemetry",
        },
      ],
    },
    assumeRole: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AssumeBedrockInvocationRole",
          Effect: "Allow",
          Action: "sts:AssumeRole",
          Resource: "arn:aws:iam::444455556666:role/rpl-bedrock-invocation",
          Condition: { StringEquals: { "sts:ExternalId": "rpl-prod-2026" } },
        },
      ],
    },
    notes: "Tenant isolation enforced via DynamoDB LeadingKeys condition tied to PrincipalTag. Bedrock access scoped to two named foundation models. Cross-account AssumeRole used when calling shared Bedrock invocation role.",
  },
  lambda: {
    trust: TRUST_LAMBDA,
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "DecayScan",
          Effect: "Allow",
          Action: ["dynamodb:Scan", "dynamodb:BatchWriteItem"],
          Resource: "arn:aws:dynamodb:us-east-1:111122223333:table/rpl-reputation",
        },
        {
          Sid: "Logs",
          Effect: "Allow",
          Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
          Resource: "arn:aws:logs:us-east-1:111122223333:log-group:/aws/lambda/rpl-decay:*",
        },
      ],
    },
    notes: "EventBridge-triggered every 30s. Read-write scoped to the reputation table only.",
  },
  bedrock: {
    trust: TRUST_BEDROCK,
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "GuardrailEnforce",
          Effect: "Allow",
          Action: ["bedrock:ApplyGuardrail"],
          Resource: "arn:aws:bedrock:us-east-1:111122223333:guardrail/rpl-default",
        },
      ],
    },
    notes: "Bedrock service role attaches the default guardrail to every invocation. No outbound network calls from this principal.",
  },
  strands: {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: { Version: "2012-10-17", Statement: [] },
    notes: "Strands runs in-process within the ECS task. It inherits the task role; no separate IAM principal is provisioned.",
  },
  dynamodb: {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "RestrictResourcePolicy",
          Effect: "Deny",
          Principal: "*",
          Action: "dynamodb:*",
          Resource: "arn:aws:dynamodb:us-east-1:111122223333:table/rpl-reputation",
          Condition: {
            StringNotEquals: {
              "aws:PrincipalAccount": "111122223333",
            },
          },
        },
      ],
    },
    notes: "Resource-based policy denies any cross-account access. PITR enabled. Server-side encryption with customer-managed KMS key.",
  },
  elasticache: {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "ConnectFromVpc",
          Effect: "Allow",
          Action: "elasticache:Connect",
          Resource: "arn:aws:elasticache:us-east-1:111122223333:replicationgroup:rpl-rep-cache",
          Condition: {
            StringEquals: {
              "aws:SourceVpc": "vpc-rpl-prod",
            },
          },
        },
      ],
    },
    notes: "VPC-scoped access only; no public endpoint. AUTH token rotated weekly via Secrets Manager.",
  },
  kinesis: {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "ProducerOnly",
          Effect: "Allow",
          Action: ["kinesis:PutRecord", "kinesis:PutRecords", "kinesis:DescribeStream"],
          Resource: "arn:aws:kinesis:us-east-1:111122223333:stream/rpl-telemetry",
        },
      ],
    },
    notes: "ECS task role can only produce; consumers (Firehose, anomaly Lambda) have separate read-only roles.",
  },
  s3: {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "FirehoseWrite",
          Effect: "Allow",
          Action: ["s3:PutObject", "s3:PutObjectAcl"],
          Resource: "arn:aws:s3:::rpl-telemetry-lake/year=*/month=*/day=*/*",
        },
        {
          Sid: "AthenaRead",
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:ListBucket"],
          Resource: [
            "arn:aws:s3:::rpl-telemetry-lake",
            "arn:aws:s3:::rpl-telemetry-lake/*",
          ],
          Condition: {
            StringEquals: {
              "aws:PrincipalTag/role": "analyst",
            },
          },
        },
      ],
    },
    notes: "Bucket policy denies any non-TLS request. Athena reads gated by analyst PrincipalTag.",
  },
  cloudwatch: {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "EmitMetricsAndTraces",
          Effect: "Allow",
          Action: [
            "cloudwatch:PutMetricData",
            "xray:PutTraceSegments",
            "xray:PutTelemetryRecords",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          Resource: "*",
          Condition: {
            StringEquals: {
              "cloudwatch:namespace": "RPL/Routing",
            },
          },
        },
      ],
    },
    notes: "Metric writes restricted to the RPL/Routing namespace. Trace and log ingestion is account-wide by AWS design.",
  },
  cloudtrail: {
    trust: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "cloudtrail.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "DeliverToAuditAccount",
          Effect: "Allow",
          Action: ["s3:PutObject"],
          Resource: "arn:aws:s3:::rpl-audit-trail-777788889999/AWSLogs/111122223333/*",
          Condition: { StringEquals: { "s3:x-amz-acl": "bucket-owner-full-control" } },
        },
        {
          Sid: "WriteKmsForAuditBucket",
          Effect: "Allow",
          Action: ["kms:GenerateDataKey"],
          Resource: "arn:aws:kms:us-east-1:777788889999:key/audit-trail-cmk",
        },
      ],
    },
    notes: "Multi-region trail with management + Bedrock InvokeModel data events. Delivered cross-account to a write-once audit bucket with object lock (compliance mode, 7-year retention).",
  },
  kms: {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowDataPlaneServices",
          Effect: "Allow",
          Principal: {
            AWS: [
              "arn:aws:iam::111122223333:role/rpl-ecs-task",
              "arn:aws:iam::111122223333:role/rpl-decay-lambda",
            ],
          },
          Action: ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"],
          Resource: "*",
          Condition: {
            StringEquals: {
              "kms:ViaService": [
                "dynamodb.us-east-1.amazonaws.com",
                "s3.us-east-1.amazonaws.com",
                "secretsmanager.us-east-1.amazonaws.com",
              ],
            },
          },
        },
        {
          Sid: "DenyDeleteWithoutMfa",
          Effect: "Deny",
          Principal: "*",
          Action: ["kms:ScheduleKeyDeletion", "kms:DisableKey"],
          Resource: "*",
          Condition: { BoolIfExists: { "aws:MultiFactorAuthPresent": "false" } },
        },
      ],
    },
    notes: "Customer-managed key. ViaService condition restricts use to specific AWS services; deletion requires MFA. Annual rotation enabled. Key usage events flow to CloudTrail.",
  },
  "vpc-endpoints": {
    trust: { Version: "2012-10-17", Statement: [] },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowOnlyOurAccountAndBedrockModels",
          Effect: "Allow",
          Principal: { AWS: "arn:aws:iam::111122223333:root" },
          Action: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
          Resource: [
            "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*",
            "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-*",
          ],
          Condition: {
            StringEquals: { "aws:SourceVpc": "vpc-rpl-prod" },
          },
        },
        {
          Sid: "DenyAnyOtherAccount",
          Effect: "Deny",
          Principal: "*",
          Action: "*",
          Resource: "*",
          Condition: {
            StringNotEquals: { "aws:PrincipalAccount": "111122223333" },
          },
        },
      ],
    },
    notes: "Interface endpoint policy for the Bedrock VPCE. Restricts access to a single account, a single VPC, and a curated list of foundation models. Same pattern applied to DynamoDB, KMS, and Secrets Manager endpoints.",
  },
  "aws-config": {
    trust: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "config.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    },
    execution: {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "EvaluateAndRemediate",
          Effect: "Allow",
          Action: [
            "config:Put*",
            "config:Get*",
            "config:Describe*",
            "ssm:StartAutomationExecution",
          ],
          Resource: "*",
        },
      ],
    },
    notes: "Runs the AWS Well-Architected Reliability + Security conformance packs. Auto-remediation runbooks invoked via SSM (e.g., re-encrypt unencrypted EBS, block public S3 ACLs).",
  },
};
