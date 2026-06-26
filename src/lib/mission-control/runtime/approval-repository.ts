// Phase 6 — approval repository. Tenant-scoped persistence for approval requests
// and approval policies. The decision helper is the single seam through which a
// request transitions to approved/rejected/cancelled.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalSubjectType,
} from "./mission-control-hardening-types";
import type { ApprovalPolicy } from "../approvals/approval-policy-types";

export async function createApprovalRequest(input: {
  tenantId: string;
  subjectType: ApprovalSubjectType;
  subjectId: string;
  policyId?: string | null;
  requestedBy?: string | null;
  assignedTo?: string | null;
  reason?: string | null;
}): Promise<ApprovalRequest> {
  return await db.approvalRequests.insert({
    id: id("appr"),
    tenantId: input.tenantId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    policyId: input.policyId ?? null,
    status: "pending",
    requestedBy: input.requestedBy ?? null,
    assignedTo: input.assignedTo ?? null,
    reason: input.reason ?? null,
    decisionNote: null,
    decidedBy: null,
    createdAt: now(),
    decidedAt: null,
  });
}

export async function getApprovalRequest(
  tenantId: string,
  approvalRequestId: string,
): Promise<ApprovalRequest | undefined> {
  return await db.approvalRequests.get(tenantId, approvalRequestId);
}

export async function findPendingApprovalForSubject(
  tenantId: string,
  subjectType: ApprovalSubjectType,
  subjectId: string,
): Promise<ApprovalRequest | undefined> {
  return await db.approvalRequests.find(
    tenantId,
    (a) => a.status === "pending" && a.subjectType === subjectType && a.subjectId === subjectId,
  );
}

export async function listPendingApprovals(tenantId: string): Promise<ApprovalRequest[]> {
  return (await db.approvalRequests.list(tenantId, (a) => a.status === "pending")).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function decideApproval(input: {
  tenantId: string;
  approvalRequestId: string;
  status: Exclude<ApprovalStatus, "pending">;
  decidedBy?: string | null;
  decisionNote?: string | null;
}): Promise<ApprovalRequest> {
  const request = await db.approvalRequests.get(input.tenantId, input.approvalRequestId);
  if (!request) throw new Error(`Approval request not found: ${input.approvalRequestId}`);
  if (request.status !== "pending") {
    throw new Error(`Approval request already decided: ${request.status}`);
  }
  return await db.approvalRequests.update(request.id, {
    status: input.status,
    decidedBy: input.decidedBy ?? null,
    decisionNote: input.decisionNote ?? null,
    decidedAt: now(),
  });
}

// ── Approval policies ──────────────────────────────────────────────────────

export async function getApprovalPolicyByKey(
  tenantId: string,
  key: string,
): Promise<ApprovalPolicy | undefined> {
  return await db.approvalPolicies.find(tenantId, (p) => p.key === key);
}

export async function listApprovalPolicies(tenantId: string): Promise<ApprovalPolicy[]> {
  return await db.approvalPolicies.list(tenantId);
}

export async function upsertApprovalPolicy(policy: ApprovalPolicy): Promise<ApprovalPolicy> {
  const existing = await getApprovalPolicyByKey(policy.tenantId, policy.key);
  if (existing) return await db.approvalPolicies.update(existing.id, { ...policy, id: existing.id });
  return await db.approvalPolicies.insert(policy);
}
