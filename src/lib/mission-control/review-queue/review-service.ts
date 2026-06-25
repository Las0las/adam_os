// Review queue (§37). Human-in-the-loop cases for low-confidence AI output,
// validation exceptions, and gated actions.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import type { ReviewCase, ReviewCaseEvent } from "@/types/mission-control";

export function openReviewCase(
  ctx: ActorContext,
  input: {
    caseType: string;
    subject?: { type: string; id: string };
    severity?: ReviewCase["severity"];
    summary?: string;
    gatedActionExecutionId?: string;
  },
): ReviewCase {
  const rc = db.reviewCases.insert({
    id: id("review"),
    tenantId: ctx.tenantId,
    caseType: input.caseType,
    subjectObjectType: input.subject?.type ?? null,
    subjectObjectId: input.subject?.id ?? null,
    status: "open",
    severity: input.severity,
    summary: input.summary ?? null,
    gatedActionExecutionId: input.gatedActionExecutionId ?? null,
    assigneeUserId: null,
    createdAt: now(),
  });
  recordEvent(ctx, rc.id, "created");
  emitAudit(ctx, "review.case.open", { type: "review_case", id: rc.id }, { caseType: input.caseType });
  return rc;
}

export function resolveReviewCase(
  ctx: ActorContext,
  reviewCaseId: string,
  decision: "approved" | "rejected" | "resolved",
  note?: string,
): ReviewCase {
  requirePermission(ctx, "review.reviewer");
  const rc = db.reviewCases.get(ctx.tenantId, reviewCaseId);
  if (!rc) throw new Error(`Review case not found: ${reviewCaseId}`);
  const updated = db.reviewCases.update(rc.id, { status: decision });
  recordEvent(ctx, rc.id, decision, note);
  emitAudit(ctx, `review.case.${decision}`, { type: "review_case", id: rc.id }, { note });
  return updated;
}

export function listReviewCases(ctx: ActorContext, status?: ReviewCase["status"]): ReviewCase[] {
  return db.reviewCases
    .list(ctx.tenantId, status ? (c) => c.status === status : undefined)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function recordEvent(
  ctx: ActorContext,
  reviewCaseId: string,
  kind: ReviewCaseEvent["kind"],
  note?: string,
): void {
  db.reviewCaseEvents.insert({
    id: id("revevt"),
    tenantId: ctx.tenantId,
    reviewCaseId,
    actorUserId: ctx.actorUserId ?? null,
    kind,
    note: note ?? null,
    createdAt: now(),
  });
}
