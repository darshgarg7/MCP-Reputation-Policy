/**
 * Deterministic region assignment for a data source. Given a stable server_id,
 * always returns the same AWS region. Used by the failover scenario + telemetry
 * UI so a "regional incident" reads as visually obvious without backend support.
 */

export const RPL_REGIONS = ["us-east-1", "us-west-2", "eu-west-1"] as const;
export type RplRegion = (typeof RPL_REGIONS)[number];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function regionFor(sourceId: string): RplRegion {
  return RPL_REGIONS[hash(sourceId) % RPL_REGIONS.length];
}

export const REGION_COLORS: Record<RplRegion, string> = {
  "us-east-1": "oklch(0.72 0.16 220)",
  "us-west-2": "oklch(0.84 0.21 148)",
  "eu-west-1": "oklch(0.75 0.18 300)",
};
