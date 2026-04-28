/**
 * Active tenant context — UI-side simulation of multi-tenant IAM isolation.
 * Backend stays untouched; the IAM policies in src/lib/iam-policies.ts use
 * ${aws:PrincipalTag/tenant} which we render with the live tenant value so
 * operators can SEE the isolation rather than infer it.
 */

export interface Tenant {
  id: string;
  label: string;
  region: string;
  /** Hex-ish color used for badges. */
  color: string;
}

export const TENANTS: Tenant[] = [
  { id: "acme-prod",        label: "Acme Corp · prod",      region: "us-east-1", color: "oklch(0.84 0.21 148)" },
  { id: "globex-eu",        label: "Globex · EU",           region: "eu-west-1", color: "oklch(0.78 0.18 245)" },
  { id: "initech-staging",  label: "Initech · staging",     region: "us-west-2", color: "oklch(0.80 0.18 65)"  },
];

type Listener = (id: string) => void;

let current: string = TENANTS[0].id;
const listeners = new Set<Listener>();

export function getTenantId(): string {
  return current;
}

export function getTenant(): Tenant {
  return TENANTS.find((t) => t.id === current) ?? TENANTS[0];
}

export function setTenantId(id: string) {
  if (!TENANTS.some((t) => t.id === id) || id === current) return;
  current = id;
  for (const fn of listeners) fn(id);
}

export function subscribeTenant(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

import { useSyncExternalStore } from "react";

export function useTenant(): Tenant {
  const id = useSyncExternalStore(
    (cb) => subscribeTenant(cb),
    () => current,
    () => current,
  );
  return TENANTS.find((t) => t.id === id) ?? TENANTS[0];
}
