// VS-008 — governance enforcement mode. Mirrors the object (ADR-0006),
// relationship (ADR-0008), and graph (ADR-0009) enforcement exactly. The
// orchestrator resolves ONE governance mode and applies a single execution
// decision; it calls every sub-service in warn mode internally so nothing throws
// mid-pipeline.
//
// Precedence: per-tenant → global → env (ONTOLOGY_GOVERNANCE_ENFORCEMENT) →
// default ("warn"). Independent of the object/relationship/graph modes.

export type GovernanceEnforcementMode = "warn" | "enforce";

const tenantOverrides = new Map<string, GovernanceEnforcementMode>();
let globalOverride: GovernanceEnforcementMode | undefined;

function envMode(): GovernanceEnforcementMode {
  const raw = (process.env.ONTOLOGY_GOVERNANCE_ENFORCEMENT ?? "").trim().toLowerCase();
  return raw === "enforce" ? "enforce" : "warn";
}

export function resolveGovernanceEnforcementMode(tenantId: string): GovernanceEnforcementMode {
  const perTenant = tenantOverrides.get(tenantId);
  if (perTenant) return perTenant;
  if (globalOverride) return globalOverride;
  return envMode();
}

export function setGlobalGovernanceEnforcementMode(mode: GovernanceEnforcementMode | undefined): void {
  globalOverride = mode;
}

export function setTenantGovernanceEnforcementMode(tenantId: string, mode: GovernanceEnforcementMode): void {
  tenantOverrides.set(tenantId, mode);
}

export function clearTenantGovernanceEnforcementMode(tenantId: string): void {
  tenantOverrides.delete(tenantId);
}

export function resetGovernanceEnforcementOverrides(): void {
  tenantOverrides.clear();
  globalOverride = undefined;
}
