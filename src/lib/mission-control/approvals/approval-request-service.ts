// Phase 6 — approval request service. Creates approval requests for governance
// subjects, emits audit, and queues approver notifications. Fail-closed: a
// reason-required policy with no reason throws before any request is created.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { notifyAdmins } from "../notifications/internal-notify";
import {
  createApprovalRequest,
  findPendingApprovalForSubject,
  getApprovalPolicyByKey,
} from "../runtime/approval-repository";
import { evaluateApprovalPolicy } from "./approval-policy-engine";
import type { ActorContext } from "@/types/platform";
import type { ApprovalRequest, ApprovalSubjectType } from "../runtime/mission-control-hardening-types";

export interface CreateApprovalInput {
  subjectType: ApprovalSubjectType;
  subjectId: string;
  /** Policy key to evaluate; if omitted the engine fails closed. */
  policyKey?: string;
  subjectPayload?: Record<string, unknown>;
  reason?: string | null;
  assignedTo?: string | null;
}

export interface ApprovalDecisionContext {
  approvalRequired: boolean;
  reasonRequired: boolean;
  request: ApprovalRequest | null;
}

/**
 * Evaluate the policy for a subject and, when approval is required, create (or
 * reuse) a pending approval request. Returns whether approval is required and
 * the request (null when not required).
 */
export async function createApprovalForSubject(
  ctx: ActorContext,
  input: CreateApprovalInput,
): Promise<ApprovalDecisionContext> {
  const policy = input.policyKey
    ? await getApprovalPolicyByKey(ctx.tenantId, input.policyKey)
    : null;

  const evaluation = evaluateApprovalPolicy({
    tenantId: ctx.tenantId,
    policy,
    subjectType: input.subjectType,
    subjectPayload: input.subjectPayload ?? {},
    actorUserId: ctx.actorUserId,
  });

  if (evaluation.reasonRequired && !input.reason) {
    throw new Error(
      `Approval for ${input.subjectType} requires a reason (policy: ${input.policyKey ?? "none"}).`,
    );
  }

  if (!evaluation.approvalRequired) {
    return { approvalRequired: false, reasonRequired: evaluation.reasonRequired, request: null };
  }

  // Idempotent: reuse an existing pending request for the same subject.
  const existing = await findPendingApprovalForSubject(
    ctx.tenantId,
    input.subjectType,
    input.subjectId,
  );
  if (existing) {
    return { approvalRequired: true, reasonRequired: evaluation.reasonRequired, request: existing };
  }

  const request = await createApprovalRequest({
    tenantId: ctx.tenantId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    policyId: policy?.id ?? null,
    requestedBy: ctx.actorUserId ?? null,
    assignedTo: input.assignedTo ?? evaluation.assignedTo ?? null,
    reason: input.reason ?? null,
  });

  await emitAudit(
    ctx,
    "mission.approval.requested",
    { type: "approval_request", id: request.id },
    { subjectType: input.subjectType, subjectId: input.subjectId, policyId: policy?.id ?? null },
  );

  await notifyAdmins(ctx, {
    title: `Approval required: ${input.subjectType}`,
    body: input.reason ?? `A ${input.subjectType} requires approval.`,
    deepLink: `/mission-control?approval=${request.id}`,
  });

  return { approvalRequired: true, reasonRequired: evaluation.reasonRequired, request };
}
