/**
 * IaC snippets shown in the Deploy section of /architecture.
 * Hand-authored, illustrative — multi-region active/active topology.
 */

export const CDK_SNIPPET = `// stacks/rpl-stack.ts — AWS CDK v2 · multi-region active/active
import { Stack, StackProps, Duration, App } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as kinesis from "aws-cdk-lib/aws-kinesis";
import * as iam from "aws-cdk-lib/aws-iam";
import * as r53 from "aws-cdk-lib/aws-route53";

export const REGIONS = ["us-east-1", "us-west-2", "eu-west-1"] as const;
type Region = (typeof REGIONS)[number];

interface RplRegionalProps extends StackProps {
  primaryRegion: Region;
  replicaRegions: Region[];
}

export class RplRegionalStack extends Stack {
  public readonly table: ddb.Table;

  constructor(scope: Construct, id: string, props: RplRegionalProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 3, natGateways: 1 });

    // DynamoDB Global Table — active/active across all 3 regions.
    this.table = new ddb.Table(this, "Reputation", {
      partitionKey: { name: "tenant_pk", type: ddb.AttributeType.STRING },
      sortKey: { name: "sk", type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: ddb.TableEncryption.CUSTOMER_MANAGED,
      replicationRegions: props.replicaRegions.slice(),
      stream: ddb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    const telemetry = new kinesis.Stream(this, "Telemetry", {
      streamMode: kinesis.StreamMode.ON_DEMAND,
      retentionPeriod: Duration.hours(24),
    });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc, containerInsights: true });

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Api", {
      cluster,
      cpu: 1024,
      memoryLimitMiB: 2048,
      desiredCount: 3,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset("./service"),
        containerPort: 8000,
        environment: {
          TABLE_NAME: this.table.tableName,
          AWS_REGION: props.primaryRegion,
          // Bedrock cross-region inference profile spans all 3 regions.
          BEDROCK_INFERENCE_PROFILE: "rpl-claude-sonnet-multiregion",
        },
      },
      publicLoadBalancer: false,
    });

    this.table.grantReadWriteData(service.taskDefinition.taskRole);
    telemetry.grantWrite(service.taskDefinition.taskRole);

    service.taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      // Cross-region inference profile — Bedrock routes to nearest healthy region.
      resources: REGIONS.map((r) =>
        \`arn:aws:bedrock:\${r}:*:application-inference-profile/rpl-claude-sonnet-multiregion\`,
      ),
    }));
  }
}

// bin/app.ts — instantiate primary + replicas
const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT!;

new RplRegionalStack(app, "RplPrimary", {
  env: { account, region: "us-east-1" },
  primaryRegion: "us-east-1",
  replicaRegions: ["us-west-2", "eu-west-1"],
});

for (const region of ["us-west-2", "eu-west-1"] as const) {
  new RplRegionalStack(app, \`RplReplica-\${region}\`, {
    env: { account, region },
    primaryRegion: region,
    replicaRegions: REGIONS.filter((r) => r !== region) as Region[],
  });
}

// Route53 latency-based DNS — nearest healthy region answers.
const zone = r53.HostedZone.fromLookup(app, "Zone", { domainName: "rpl.example.com" });
for (const region of REGIONS) {
  new r53.ARecord(zone.stack, \`Latency-\${region}\`, {
    zone, recordName: "api", region, setIdentifier: region,
    target: r53.RecordTarget.fromAlias(/* per-region ALB alias */ undefined as never),
  });
}`;

export const TF_SNIPPET = `# main.tf — Terraform AWS provider 5.x · multi-region active/active
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "regions" {
  type    = list(string)
  default = ["us-east-1", "us-west-2", "eu-west-1"]
}

provider "aws" { alias = "primary"  region = "us-east-1" }
provider "aws" { alias = "replica1" region = "us-west-2" }
provider "aws" { alias = "replica2" region = "eu-west-1" }

# DynamoDB Global Table — multi-region, active-active writes.
resource "aws_dynamodb_table" "reputation" {
  provider         = aws.primary
  name             = "rpl-reputation"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "tenant_pk"
  range_key        = "sk"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute { name = "tenant_pk" type = "S" }
  attribute { name = "sk"        type = "S" }

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true kms_key_arn = aws_kms_key.ddb.arn }

  replica { region_name = "us-west-2" kms_key_arn = aws_kms_key.ddb_west.arn }
  replica { region_name = "eu-west-1" kms_key_arn = aws_kms_key.ddb_eu.arn  }
}

# Per-region Fargate + Kinesis + ALB. Module instantiated 3x.
module "rpl_region" {
  for_each                  = toset(var.regions)
  source                    = "./modules/rpl-region"
  region                    = each.value
  table_name                = aws_dynamodb_table.reputation.name
  bedrock_inference_profile = "rpl-claude-sonnet-multiregion"
}

# Route53 latency-based routing — nearest healthy region answers.
resource "aws_route53_record" "latency" {
  for_each       = toset(var.regions)
  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "api.rpl.example.com"
  type           = "A"
  set_identifier = each.value
  latency_routing_policy { region = each.value }
  alias {
    name                   = module.rpl_region[each.value].alb_dns_name
    zone_id                = module.rpl_region[each.value].alb_zone_id
    evaluate_target_health = true
  }
}`;

export const CLI_SNIPPET = `# Multi-region CloudFormation deploy — primary + 2 replicas
for REGION in us-east-1 us-west-2 eu-west-1; do
  aws cloudformation deploy \\
    --template-file infra/rpl.yaml \\
    --stack-name rpl-prod-\${REGION} \\
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \\
    --parameter-overrides \\
        ImageUri=111122223333.dkr.ecr.\${REGION}.amazonaws.com/rpl-api:latest \\
        Environment=prod \\
        BedrockInferenceProfile=rpl-claude-sonnet-multiregion \\
        ReplicaRegions=us-east-1,us-west-2,eu-west-1 \\
    --region \${REGION}
done

# Promote DynamoDB to Global Table after the primary stack lands:
aws dynamodb update-table --table-name rpl-reputation \\
  --replica-updates \\
      'Create={RegionName=us-west-2}' \\
      'Create={RegionName=eu-west-1}' \\
  --region us-east-1`;

export const BOOTSTRAP_CMD = `npx aws-cdk@2 bootstrap aws://111122223333/us-east-1 aws://111122223333/us-west-2 aws://111122223333/eu-west-1 \\
  && npx aws-cdk@2 deploy --all --require-approval never`;
