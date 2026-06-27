// Graph integrity enforcement mode (VS-005 / ADR-0009). Mirrors the object
// (ADR-0006) and relationship (ADR-0008) enforcement exactly.
//
// Resolution precedence (first match wins):
//   1. per-tenant programmatic override
//   2. global programmatic override
//   3. global env default (ONTOLOGY_GRAPH_ENFORCEMENT=enforce)
//   4. built-in default ("warn")
//
// Default is ALWAYS "warn": graph validation never throws unless an operator
// explicitly enables enforcement. Independent of object/relationship enforcement.

export type GraphEnforcementMode = "warn" | "enforce";

const tenantOverrides = new Map<string, GraphEnforcementMode>();
let globalOverride: GraphEnforcementMode | undefined;

function envMode(): GraphEnforcementMode {
  const raw = (process.env.ONTOLOGY_GRAPH_ENFORCEMENT ?? "").trim().toLowerCase();
  return raw === "enforce" ? "enforce" : "warn";
}

/** Resolve the effective graph mode for a tenant. Total — never throws. */
export function resolveGraphEnforcementMode(tenantId: string): GraphEnforcementMode {
  const perTenant = tenantOverrides.get(tenantId);
  if (perTenant) return perTenant;
  if (globalOverride) return globalOverride;
  return envMode();
}

export function setGlobalGraphEnforcementMode(mode: GraphEnforcementMode | undefined): void {
  globalOverride = mode;
}

export function setTenantGraphEnforcementMode(tenantId: string, mode: GraphEnforcementMode): void {
  tenantOverrides.set(tenantId, mode);
}

export function clearTenantGraphEnforcementMode(tenantId: string): void {
  tenantOverrides.delete(tenantId);
}

/** Clear all programmatic overrides (test isolation; does not touch env). */
export function resetGraphEnforcementOverrides(): void {
  tenantOverrides.clear();
  globalOverride = undefined;
}
