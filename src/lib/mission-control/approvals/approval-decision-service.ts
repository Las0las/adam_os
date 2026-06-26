// Phase 6 — approval decision service. Approving/rejecting a request updates the
// request, emits audit, notifies the requester, and advances the subject:
//   release_bundle  -> mark release approved
//   rollback        -> mark rollback approved
//   action_execution-> continue the gated action (if the engine supports it)

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { queueInternalNotification } from "../notifications/internal-notify";
import { decideApproval, getApprovalRequest } from "../runtime/approval-repository";
import { markReleaseApproved } from "../runtime/release-repository";
import { updateRollbackStatus } from "../runtime/rollback-repository";
import { continueApprovedAction } from "../actions/action-service";
import type { ActorContext } from "@/types/platform";
import type { ApprovalRequest } from "../runtime/mission-control-hardening-types";

async function loadPending(ctx: ActorContext, approvalRequestId: string): Promise<ApprovalRequest> {
  const request = await getApprovalRequest(ctx.tenantId, approvalRequestId);
  if (!request) throw new Error(`Approval request not found: ${approvalRequestId}`);
  return request;
}

export async function approveRequest(
  ctx: ActorContext,
  approvalRequestId: string,
  decisionNote?: string,
): Promise<ApprovalRequest> {
  requirePermission(ctx, "mission_control.admin");
  const request = await loadPending(ctx, approvalRequestId);

  const decided = await decideApproval({
    tenantId: ctx.tenantId,
    approvalRequestId,
    status: "approved",
    decidedBy: ctx.actorUserId ?? null,
    decisionNote: decisionNote ?? null,
  });

  await emitAudit(
    ctx,
    "mission.approval.approved",
    { type: "approval_request", id: request.id },
    { subjectType: request.subjectType, subjectId: request.subjectId },
  );

  // Advance the subject.
  if (request.subjectType === "release_bundle") {
    await markReleaseApproved({
      tenantId: ctx.tenantId,
      releaseBundleId: request.subjectId,
      approvedBy: ctx.actorUserId ?? null,
    });
  } else if (request.subjectType === "rollback") {
    await updateRollbackStatus({
      tenantId: ctx.tenantId,
      rollbackId: request.subjectId,
      status: "approved",
      approvedBy: ctx.actorUserId ?? null,
    });
  } else if (request.subjectType === "action_execution") {
    await continueApprovedAction(ctx, request.subjectId);
  }

  if (request.requestedBy) {
    await queueInternalNotification(ctx, {
      recipientUserId: request.requestedBy,
      title: `Approved: ${request.subjectType}`,
      body: decisionNote ?? `Your ${request.subjectType} request was approved.`,
    });
  }

  return decided;
}

export async function rejectRequest(
  ctx: ActorContext,
  approvalRequestId: string,
  decisionNote?: string,
): Promise<ApprovalRequest> {
  requirePermission(ctx, "mission_control.admin");
  const request = await loadPending(ctx, approvalRequestId);

  const decided = await decideApproval({
    tenantId: ctx.tenantId,
    approvalRequestId,
    status: "rejected",
    decidedBy: ctx.actorUserId ?? null,
    decisionNote: decisionNote ?? null,
  });

  await emitAudit(
    ctx,
    "mission.approval.rejected",
    { type: "approval_request", id: request.id },
    { subjectType: request.subjectType, subjectId: request.subjectId },
  );

  if (request.subjectType === "rollback") {
    await updateRollbackStatus({
      tenantId: ctx.tenantId,
      rollbackId: request.subjectId,
      status: "rejected",
    });
  }

  if (request.requestedBy) {
    await queueInternalNotification(ctx, {
      recipientUserId: request.requestedBy,
      title: `Rejected: ${request.subjectType}`,
      body: decisionNote ?? `Your ${request.subjectType} request was rejected.`,
    });
  }

  return decided;
}
