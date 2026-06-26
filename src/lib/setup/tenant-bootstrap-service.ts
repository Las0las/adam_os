// Phase 9 — tenant bootstrap. Provisions a tenant end-to-end on the real
// platform: tenant row, admin role + user, dev/staging/prod environments,
// default approval policies, selected domain packs, eval suites, and optional
// integration connection shells (no secrets). Idempotent and audited.

import "@/lib/domain-packs/packs";
import "@/lib/integrations/register-integrations";
import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { installMissionControlGovernance } from "@/lib/mission-control/runtime/mission-control-seed";
import { listApprovalPolicies } from "@/lib/mission-control/runtime/approval-repository";
import { listEnvironments } from "@/lib/mission-control/runtime/environment-repository";
import { installEvalSuites } from "@/lib/aiops/evals/eval-seed";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import { createConnection } from "@/lib/integrations/integration-service";
import { hasIntegrationAdapter } from "@/lib/integrations/integration-registry";
import { DEFAULT_ADMIN_PERMISSIONS } from "./default-tenant-config";
import { getBundle } from "./default-domain-pack-plan";
import { auditSetup } from "./setup-audit";
import type { IntegrationProvider } from "@/lib/integrations/integration-types";
import type { BootstrapTenantInput, BootstrapResult } from "./tenant-bootstrap-types";

export async function bootstrapTenant(input: BootstrapTenantInput): Promise<BootstrapResult> {
  const ctx = systemActor(input.tenantId);

  // 1) Tenant row.
  if (!(await db.tenants.get(input.tenantId, input.tenantId))) {
    await db.tenants.insert({
      id: input.tenantId,
      tenantId: input.tenantId,
      name: input.tenantName ?? input.tenantId,
      slug: input.tenantId,
      createdAt: now(),
    });
  }

  // 2) Admin role + permissions.
  let rolesCreated = 0;
  if (!(await db.roles.find(input.tenantId, (r) => r.name === "Administrator"))) {
    await db.roles.insert({
      id: id("role"),
      tenantId: input.tenantId,
      name: "Administrator",
      permissions: DEFAULT_ADMIN_PERMISSIONS,
    });
    rolesCreated = 1;
  }
  if (input.adminEmail && !(await db.users.find(input.tenantId, (u) => u.email === input.adminEmail))) {
    await db.users.insert({
      id: id("usr"),
      tenantId: input.tenantId,
      email: input.adminEmail,
      displayName: "Tenant Admin",
      roleIds: ["role_admin"],
      createdAt: now(),
    });
  }

  // 3) Environments + approval policies + runtime components.
  await installMissionControlGovernance(ctx);
  const environmentsCreated = (await listEnvironments(input.tenantId)).length;
  const approvalPoliciesCreated = (await listApprovalPolicies(input.tenantId)).length;

  // 4) Eval suites.
  await installEvalSuites(ctx);
  const evalSuitesInstalled = (await db.evalSuites.list(input.tenantId)).length;

  // 5) Domain packs (bundle or explicit keys).
  const packKeys = input.packKeys ?? getBundle(input.bundleKey ?? "")?.packKeys ?? [];
  const packsInstalled: string[] = [];
  for (const key of packKeys) {
    const manifest = getDomainPackManifest(key);
    if (manifest) {
      await installDomainPack(ctx, manifest);
      packsInstalled.push(key);
    }
  }

  // 6) Integration connection shells (no secrets).
  let integrationShellsCreated = 0;
  for (const shell of input.integrationShells ?? []) {
    if (hasIntegrationAdapter(shell.provider as IntegrationProvider)) {
      await createConnection(ctx, {
        key: shell.key,
        name: shell.name,
        provider: shell.provider as IntegrationProvider,
      });
      integrationShellsCreated += 1;
    }
  }

  await auditSetup(ctx, "setup.tenant_bootstrapped", {
    packsInstalled,
    environmentsCreated,
    approvalPoliciesCreated,
  });

  return {
    tenantId: input.tenantId,
    environmentsCreated,
    approvalPoliciesCreated,
    rolesCreated,
    packsInstalled,
    evalSuitesInstalled,
    integrationShellsCreated,
  };
}
