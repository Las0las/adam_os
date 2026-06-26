// Phase 9 — config export. Exports tenant configuration (NOT raw sensitive data
// or secrets). Integration connections are exported as shells with credentialRef
// names only — never secret values.

import { db } from "@/lib/lawrence-core/db";
import type { ActorContext } from "@/types/platform";

export interface ConfigExport {
  version: 1;
  tenantId: string;
  exportedAt: string;
  domainPackInstallations: Array<{ packKey: string; packVersion: string; status: string }>;
  integrationConnections: Array<{ key: string; name: string; provider: string; status: string; credentialRef: string | null }>;
  approvalPolicies: Array<{ key: string; name: string; config: Record<string, unknown> }>;
  modelDefinitions: Array<{ provider: string; modelKey: string; purpose: string; status: string }>;
  evalSuites: Array<{ key: string; name: string; suiteType: string; targetComponentKey?: string | null }>;
  environments: Array<{ key: string; name: string; environmentType: string }>;
}

export async function exportConfig(ctx: ActorContext, exportedAt: string): Promise<ConfigExport> {
  const t = ctx.tenantId;
  const [packs, integrations, policies, models, suites, environments] = await Promise.all([
    db.domainPackInstallations.list(t, (i) => i.status === "installed"),
    db.integrationConnections.list(t),
    db.approvalPolicies.list(t),
    db.modelDefinitions.list(t),
    db.evalSuites.list(t),
    db.environments.list(t),
  ]);

  return {
    version: 1,
    tenantId: t,
    exportedAt,
    domainPackInstallations: packs.map((p) => ({ packKey: p.packKey, packVersion: p.packVersion, status: p.status })),
    // credentialRef is a NAME, not a secret — the secret value never leaves the env.
    integrationConnections: integrations.map((c) => ({
      key: c.key,
      name: c.name,
      provider: c.provider,
      status: c.status,
      credentialRef: c.credentialRef ?? null,
    })),
    approvalPolicies: policies.map((p) => ({ key: p.key, name: p.name, config: p.config as unknown as Record<string, unknown> })),
    modelDefinitions: models.map((m) => ({ provider: m.provider, modelKey: m.modelKey, purpose: m.purpose, status: m.status })),
    evalSuites: suites.map((s) => ({ key: s.key, name: s.name, suiteType: s.suiteType, targetComponentKey: s.targetComponentKey })),
    environments: environments.map((e) => ({ key: e.key, name: e.name, environmentType: e.environmentType })),
  };
}
