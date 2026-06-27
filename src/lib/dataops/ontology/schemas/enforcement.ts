// ONT-001 schema enforcement mode (ADR-0006). Resolves whether canonical-object
// validation in upsertObject should warn (observe-only, default) or enforce
// (reject invalid registered objects). Fail-closed only when explicitly enabled.
//
// Resolution precedence (first match wins):
//   1. per-tenant programmatic override   (setTenantEnforcementMode)
//   2. global programmatic override        (setGlobalEnforcementMode)
//   3. global env default                  (ONTOLOGY_SCHEMA_ENFORCEMENT=enforce)
//   4. built-in default                    ("warn")
//
// The default is ALWAYS "warn": existing tenants see no behavior change unless an
// operator explicitly enables enforcement (globally via env or programmatically,
// or per tenant). Persisting per-tenant mode to the database is a future additive
// step; the in-memory overrides here are the programmatic control surface.

export type EnforcementMode = "warn" | "enforce";

const tenantOverrides = new Map<string, EnforcementMode>();
let globalOverride: EnforcementMode | undefined;

function envMode(): EnforcementMode {
  const raw = (process.env.ONTOLOGY_SCHEMA_ENFORCEMENT ?? "").trim().toLowerCase();
  return raw === "enforce" ? "enforce" : "warn";
}

/** Resolve the effective mode for a tenant. Total — never throws; defaults warn. */
export function resolveEnforcementMode(tenantId: string): EnforcementMode {
  const perTenant = tenantOverrides.get(tenantId);
  if (perTenant) return perTenant;
  if (globalOverride) return globalOverride;
  return envMode();
}

/** Set (or clear, with undefined) the global programmatic enforcement override. */
export function setGlobalEnforcementMode(mode: EnforcementMode | undefined): void {
  globalOverride = mode;
}

/** Enable a specific mode for one tenant (overrides global + env). */
export function setTenantEnforcementMode(tenantId: string, mode: EnforcementMode): void {
  tenantOverrides.set(tenantId, mode);
}

/** Remove a tenant's override, falling back to global/env/default. */
export function clearTenantEnforcementMode(tenantId: string): void {
  tenantOverrides.delete(tenantId);
}

/** Clear all programmatic overrides (test isolation; does not touch env). */
export function resetEnforcementOverrides(): void {
  tenantOverrides.clear();
  globalOverride = undefined;
}
