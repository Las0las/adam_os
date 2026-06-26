// Phase 6 — governance bootstrap. Installs the demo tenant's environments,
// approval policies, and a starter set of runtime components so the Mission
// Control control plane has live data. Idempotent (upsert/dedupe by key).

import { id, now } from "@/lib/lawrence-core/utils/ids";
import { createEnvironment } from "./environment-repository";
import { upsertApprovalPolicy } from "./approval-repository";
import { upsertRuntimeComponent } from "./runtime-component-repository";
import { resolveAction } from "../actions/action-service";
import { db } from "@/lib/lawrence-core/db";
import type { ActorContext } from "@/types/platform";
import type { ApprovalPolicy } from "../approvals/approval-policy-types";

function policy(
  ctx: ActorContext,
  key: string,
  name: string,
  config: ApprovalPolicy["config"],
  subjectTypes: ApprovalPolicy["subjectTypes"],
): ApprovalPolicy {
  return { id: id("apol"), tenantId: ctx.tenantId, key, name, subjectTypes, config, createdAt: now() };
}

export async function installMissionControlGovernance(ctx: ActorContext): Promise<void> {
  // Environments.
  await createEnvironment({ tenantId: ctx.tenantId, key: "dev", name: "Development", environmentType: "dev" });
  await createEnvironment({ tenantId: ctx.tenantId, key: "staging", name: "Staging", environmentType: "staging" });
  await createEnvironment({ tenantId: ctx.tenantId, key: "prod", name: "Production", environmentType: "prod" });

  // Approval policies.
  await upsertApprovalPolicy(
    policy(ctx, "prod_release_requires_approval", "Production release requires approval",
      { requireApproval: true, reasonRequired: false, approverRoleKeys: ["role_admin"] }, ["release_bundle"]),
  );
  await upsertApprovalPolicy(
    policy(ctx, "rollback_requires_approval", "Rollback requires approval",
      { requireApproval: true, reasonRequired: true, allowEmergencyBypass: true }, ["rollback"]),
  );
  await upsertApprovalPolicy(
    policy(ctx, "kill_switch_requires_reason", "Kill switch requires reason",
      { requireApproval: false, reasonRequired: true }, ["kill_switch"]),
  );
  await upsertApprovalPolicy(
    policy(ctx, "external_side_effect_requires_approval", "External side-effect action requires approval",
      { requireApproval: true, reasonRequired: false, rules: [{ field: "external", operator: "eq", value: true }] },
      ["action_execution"]),
  );
  await upsertApprovalPolicy(
    policy(ctx, "destructive_action_requires_approval", "Destructive action requires approval",
      { requireApproval: true, reasonRequired: true }, ["action_execution"]),
  );

  // Runtime components: register the seeded functions / agents / actions as
  // active runtime components (default environment) so health + overview show
  // real wiring.
  const env = await db.environments.find(ctx.tenantId, (e) => e.key === "prod");
  const envId = env?.id ?? null;

  for (const fn of await db.aiFunctions.list(ctx.tenantId)) {
    await upsertRuntimeComponent({
      tenantId: ctx.tenantId,
      componentType: "function",
      componentKey: fn.key,
      componentId: fn.id,
      environmentId: envId,
      status: fn.status === "active" ? "enabled" : "disabled",
    });
  }
  for (const agent of await db.agentDefinitions.list(ctx.tenantId)) {
    await upsertRuntimeComponent({
      tenantId: ctx.tenantId,
      componentType: "agent",
      componentKey: agent.key,
      componentId: agent.id,
      environmentId: envId,
      status: agent.status === "active" ? "enabled" : "disabled",
    });
  }
  for (const action of await db.actionDefinitions.list(ctx.tenantId)) {
    await upsertRuntimeComponent({
      tenantId: ctx.tenantId,
      componentType: "action",
      componentKey: action.key,
      componentId: action.id,
      environmentId: envId,
      status: resolveAction(action.key) ? "enabled" : "disabled",
    });
  }
}
