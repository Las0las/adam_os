// Phase 6 — kill switch service. Enabling requires a reason and admin
// permission; if a policy explicitly requires approval, an approval request is
// created and the switch is NOT enabled until approved. Enabling/disabling sets
// the runtime component status, emits audit, and notifies admins.
//
// Note: enabling a kill switch is an emergency safety stop, so a MISSING policy
// does not block enablement (only reason is required). Approval is gated only
// when a policy is present and explicitly requires it.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { notifyAdmins } from "../notifications/internal-notify";
import {
  disableKillSwitch as disableKillSwitchRow,
  enableKillSwitch as enableKillSwitchRow,
} from "./kill-switch-repository";
import { setRuntimeComponentStatus } from "./runtime-component-repository";
import { getEnvironmentByKey } from "./environment-repository";
import { getApprovalPolicyByKey, createApprovalRequest } from "./approval-repository";
import type { ActorContext } from "@/types/platform";
import type {
  ApprovalRequest,
  KillSwitch,
  RuntimeComponentType,
} from "./mission-control-hardening-types";

export interface KillSwitchInput {
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentKey?: string;
  reason: string;
  actorUserId?: string | null;
}

export interface KillSwitchResult {
  enabled: boolean;
  killSwitch?: KillSwitch;
  approvalRequest?: ApprovalRequest;
}

async function resolveEnvId(ctx: ActorContext, environmentKey?: string): Promise<string | null> {
  if (!environmentKey) return null;
  const env = await getEnvironmentByKey(ctx.tenantId, environmentKey);
  if (!env) throw new Error(`Environment not found: ${environmentKey}`);
  return env.id;
}

export async function enableKillSwitch(
  ctx: ActorContext,
  input: KillSwitchInput,
): Promise<KillSwitchResult> {
  requirePermission(ctx, "mission_control.admin");
  if (!input.reason || !input.reason.trim()) {
    throw new Error("Enabling a kill switch requires a reason.");
  }
  const environmentId = await resolveEnvId(ctx, input.environmentKey);

  // Approval gate only when a policy explicitly requires it.
  const policy = await getApprovalPolicyByKey(ctx.tenantId, "kill_switch_requires_approval");
  if (policy?.config.requireApproval) {
    const request = await createApprovalRequest({
      tenantId: ctx.tenantId,
      subjectType: "kill_switch",
      subjectId: `${input.componentType}:${input.componentKey}`,
      policyId: policy.id,
      requestedBy: ctx.actorUserId ?? null,
      reason: input.reason,
    });
    await emitAudit(
      ctx,
      "mission.approval.requested",
      { type: "approval_request", id: request.id },
      { subjectType: "kill_switch", subjectId: request.subjectId },
    );
    return { enabled: false, approvalRequest: request };
  }

  const killSwitch = await enableKillSwitchRow({
    tenantId: ctx.tenantId,
    componentType: input.componentType,
    componentKey: input.componentKey,
    environmentId,
    reason: input.reason,
    enabledBy: ctx.actorUserId ?? null,
  });

  await setRuntimeComponentStatus({
    tenantId: ctx.tenantId,
    componentType: input.componentType,
    componentKey: input.componentKey,
    environmentId,
    status: "disabled",
  });

  await emitAudit(
    ctx,
    "mission.kill_switch.enabled",
    { type: "kill_switch", id: killSwitch.id },
    { componentType: input.componentType, componentKey: input.componentKey, reason: input.reason },
  );

  await notifyAdmins(ctx, {
    title: `Kill switch enabled: ${input.componentType}:${input.componentKey}`,
    body: input.reason,
  });

  return { enabled: true, killSwitch };
}

export async function disableKillSwitch(
  ctx: ActorContext,
  input: { componentType: RuntimeComponentType; componentKey: string; environmentKey?: string; reason?: string | null },
): Promise<KillSwitch | undefined> {
  requirePermission(ctx, "mission_control.admin");
  const environmentId = await resolveEnvId(ctx, input.environmentKey);

  const killSwitch = await disableKillSwitchRow({
    tenantId: ctx.tenantId,
    componentType: input.componentType,
    componentKey: input.componentKey,
    environmentId,
    reason: input.reason ?? null,
    disabledBy: ctx.actorUserId ?? null,
  });
  if (!killSwitch) return undefined;

  await setRuntimeComponentStatus({
    tenantId: ctx.tenantId,
    componentType: input.componentType,
    componentKey: input.componentKey,
    environmentId,
    status: "enabled",
  });

  await emitAudit(
    ctx,
    "mission.kill_switch.disabled",
    { type: "kill_switch", id: killSwitch.id },
    { componentType: input.componentType, componentKey: input.componentKey },
  );

  return killSwitch;
}
