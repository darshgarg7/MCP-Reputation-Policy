/**
 * Compliance framework mappings per service. Surfaced as chips in the
 * architecture side-panel so security reviewers can trace controls back
 * to specific framework requirements.
 */

export interface ComplianceMapping {
  framework: "SOC2" | "HIPAA" | "PCI-DSS" | "ISO 27001" | "FedRAMP";
  control: string;
  evidence: string;
}

export const COMPLIANCE_BY_SERVICE: Record<string, ComplianceMapping[]> = {
  cloudtrail: [
    { framework: "SOC2", control: "CC7.2", evidence: "Continuous monitoring of all control-plane API activity." },
    { framework: "HIPAA", control: "§164.312(b)", evidence: "Audit controls for ePHI access events." },
    { framework: "PCI-DSS", control: "10.2", evidence: "Audit trail for all access to system components." },
    { framework: "ISO 27001", control: "A.12.4.1", evidence: "Event logging of user activity, exceptions, and security events." },
  ],
  kms: [
    { framework: "SOC2", control: "CC6.1", evidence: "Logical access controls via key policies + IAM." },
    { framework: "HIPAA", control: "§164.312(a)(2)(iv)", evidence: "Encryption and decryption of ePHI at rest." },
    { framework: "PCI-DSS", control: "3.5", evidence: "Cryptographic key lifecycle management with annual rotation." },
    { framework: "FedRAMP", control: "SC-12", evidence: "FIPS 140-2 validated key establishment." },
  ],
  "vpc-endpoints": [
    { framework: "SOC2", control: "CC6.6", evidence: "Restricts AWS service traffic to private VPC paths." },
    { framework: "HIPAA", control: "§164.312(e)(1)", evidence: "Transmission security — no public-internet egress." },
    { framework: "PCI-DSS", control: "1.3", evidence: "Network segmentation between trusted/untrusted zones." },
  ],
  "aws-config": [
    { framework: "SOC2", control: "CC7.1", evidence: "Continuous detection of configuration drift." },
    { framework: "ISO 27001", control: "A.12.5.1", evidence: "Change management of operational systems." },
    { framework: "FedRAMP", control: "CM-2", evidence: "Baseline configuration enforcement." },
  ],
  cloudfront: [
    { framework: "PCI-DSS", control: "4.1", evidence: "TLS 1.2+ termination at the edge." },
  ],
  apigateway: [
    { framework: "SOC2", control: "CC6.1", evidence: "JWT-validated requests; per-tenant rate limits." },
  ],
  ecs: [
    { framework: "SOC2", control: "CC6.3", evidence: "Tenant isolation via PrincipalTag-conditioned IAM." },
    { framework: "HIPAA", control: "§164.308(a)(4)", evidence: "Information access management at the workload tier." },
  ],
  bedrock: [
    { framework: "SOC2", control: "CC6.7", evidence: "Bedrock guardrails enforce content + PII filters on every invocation." },
  ],
  dynamodb: [
    { framework: "PCI-DSS", control: "3.4", evidence: "Customer-managed KMS encryption at rest." },
    { framework: "HIPAA", control: "§164.308(a)(7)", evidence: "PITR enables 35-day disaster recovery." },
  ],
  s3: [
    { framework: "PCI-DSS", control: "3.4", evidence: "SSE-KMS at rest; bucket policy denies non-TLS." },
  ],
};

export function complianceFor(serviceId: string): ComplianceMapping[] {
  return COMPLIANCE_BY_SERVICE[serviceId] ?? [];
}
