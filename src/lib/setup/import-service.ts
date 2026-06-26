// Phase 9 — config import. Validates an exported config, supports dry-run, and
// (apply mode) recreates environments, approval policies, and integration
// connection shells. Never imports secrets. Apply requires admin permission.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { createEnvironment } from "@/lib/mission-control/runtime/environment-repository";
import { upsertApprovalPolicy } from "@/lib/mission-control/runtime/approval-repository";
import { createConnection } from "@/lib/integrations/integration-service";
import { hasIntegrationAdapter } from "@/lib/integrations/integration-registry";
import { auditSetup } from "./setup-audit";
import type { ActorContext } from "@/types/platform";
import type { ConfigExport } from "./export-service";
import type { EnvironmentType } from "@/lib/mission-control/runtime/mission-control-hardening-types";
import type { IntegrationProvider } from "@/lib/integrations/integration-types";

export interface ImportResult {
  valid: boolean;
  errors: string[];
  applied: boolean;
  environments: number;
  approvalPolicies: number;
  integrations: number;
}

export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const c = config as Partial<ConfigExport> | null;
  if (!c || typeof c !== "object") return { valid: false, errors: ["config is not an object"] };
  if (c.version !== 1) errors.push("unsupported export version");
  if (!Array.isArray(c.environments)) errors.push("environments must be an array");
  if (!Array.isArray(c.approvalPolicies)) errors.push("approvalPolicies must be an array");
  return { valid: errors.length === 0, errors };
}

export async function importConfig(
  ctx: ActorContext,
  config: ConfigExport,
  opts: { apply?: boolean } = {},
): Promise<ImportResult> {
  const validation = validateConfig(config);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, applied: false, environments: 0, approvalPolicies: 0, integrations: 0 };
  }

  if (!opts.apply) {
    // Dry run — report what would be applied.
    return {
      valid: true,
      errors: [],
      applied: false,
      environments: config.environments.length,
      approvalPolicies: config.approvalPolicies.length,
      integrations: config.integrationConnections.length,
    };
  }

  requirePermission(ctx, "mission_control.admin");

  for (const env of config.environments) {
    await createEnvironment({
      tenantId: ctx.tenantId,
      key: env.key,
      name: env.name,
      environmentType: env.environmentType as EnvironmentType,
    });
  }
  for (const p of config.approvalPolicies) {
    await upsertApprovalPolicy({
      id: id("apol"),
      tenantId: ctx.tenantId,
      key: p.key,
      name: p.name,
      config: p.config as never,
      createdAt: now(),
    });
  }
  let integrations = 0;
  for (const c of config.integrationConnections) {
    if (hasIntegrationAdapter(c.provider as IntegrationProvider)) {
      await createConnection(ctx, {
        key: c.key,
        name: c.name,
        provider: c.provider as IntegrationProvider,
        credentialRef: c.credentialRef, // a ref name only; secret stays in env
      });
      integrations += 1;
    }
  }

  await auditSetup(ctx, "setup.config_imported", {
    environments: config.environments.length,
    approvalPolicies: config.approvalPolicies.length,
    integrations,
  });

  return {
    valid: true,
    errors: [],
    applied: true,
    environments: config.environments.length,
    approvalPolicies: config.approvalPolicies.length,
    integrations,
  };
}
