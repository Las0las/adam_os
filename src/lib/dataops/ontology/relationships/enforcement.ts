// ONT-002 relationship enforcement mode (ADR-0008). Parallel to the object schema
// enforcement (schemas/enforcement.ts): resolves whether canonical-relationship
// validation in linkObjects should warn (observe-only, default) or enforce (reject
// invalid REGISTERED relationships). Fail-closed only when explicitly enabled.
//
// Resolution precedence (first match wins):
//   1. per-tenant programmatic override   (setTenantRelationshipEnforcementMode)
//   2. global programmatic override        (setGlobalRelationshipEnforcementMode)
//   3. global env default                  (ONTOLOGY_RELATIONSHIP_ENFORCEMENT=enforce)
//   4. built-in default                    ("warn")
//
// The default is ALWAYS "warn": existing tenants see no behavior change unless an
// operator explicitly enables enforcement. Relationship enforcement is independent
// of object enforcement (a tenant may enable one without the other).

export type RelationshipEnforcementMode = "warn" | "enforce";

const tenantOverrides = new Map<string, RelationshipEnforcementMode>();
let globalOverride: RelationshipEnforcementMode | undefined;

function envMode(): RelationshipEnforcementMode {
  const raw = (process.env.ONTOLOGY_RELATIONSHIP_ENFORCEMENT ?? "").trim().toLowerCase();
  return raw === "enforce" ? "enforce" : "warn";
}

/** Resolve the effective relationship mode for a tenant. Total — never throws. */
export function resolveRelationshipEnforcementMode(tenantId: string): RelationshipEnforcementMode {
  const perTenant = tenantOverrides.get(tenantId);
  if (perTenant) return perTenant;
  if (globalOverride) return globalOverride;
  return envMode();
}

/** Set (or clear, with undefined) the global programmatic override. */
export function setGlobalRelationshipEnforcementMode(mode: RelationshipEnforcementMode | undefined): void {
  globalOverride = mode;
}

/** Enable a specific mode for one tenant (overrides global + env). */
export function setTenantRelationshipEnforcementMode(tenantId: string, mode: RelationshipEnforcementMode): void {
  tenantOverrides.set(tenantId, mode);
}

/** Remove a tenant's override, falling back to global/env/default. */
export function clearTenantRelationshipEnforcementMode(tenantId: string): void {
  tenantOverrides.delete(tenantId);
}

/** Clear all programmatic overrides (test isolation; does not touch env). */
export function resetRelationshipEnforcementOverrides(): void {
  tenantOverrides.clear();
  globalOverride = undefined;
}
