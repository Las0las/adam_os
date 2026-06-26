// Phase 9 — tenant bootstrap contracts.

export interface BootstrapTenantInput {
  tenantId: string;
  tenantName?: string;
  adminEmail?: string;
  /** Pack bundle key (see default-domain-pack-plan) or explicit pack keys. */
  bundleKey?: string;
  packKeys?: string[];
  /** Integration connection shells to pre-create (no secrets). */
  integrationShells?: Array<{ key: string; name: string; provider: string }>;
}

export interface BootstrapResult {
  tenantId: string;
  environmentsCreated: number;
  approvalPoliciesCreated: number;
  rolesCreated: number;
  packsInstalled: string[];
  evalSuitesInstalled: number;
  integrationShellsCreated: number;
}
