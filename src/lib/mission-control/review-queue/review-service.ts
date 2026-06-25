// Review queue (§37). Human-in-the-loop cases for low-confidence AI output,
// validation exceptions, and gated actions.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import type { ReviewCase, ReviewCaseEvent } from "@/types/mission-control";

export async function openReviewCase(
  ctx: ActorContext,
  input: {
    caseType: string;
    subject?: { type: string; id: string };
    severity?: ReviewCase["severity"];
    summary?: string;
    gatedActionExecutionId?: string;
  },
): Promise<ReviewCase> {
  const rc = await db.reviewCases.insert({
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
  await recordEvent(ctx, rc.id, "created");
  await emitAudit(ctx, "review.case.open", { type: "review_case", id: rc.id }, { caseType: input.caseType });
  return rc;
}

export async function resolveReviewCase(
  ctx: ActorContext,
  reviewCaseId: string,
  decision: "approved" | "rejected" | "resolved",
  note?: string,
): Promise<ReviewCase> {
  requirePermission(ctx, "review.reviewer");
  const rc = await db.reviewCases.get(ctx.tenantId, reviewCaseId);
  if (!rc) throw new Error(`Review case not found: ${reviewCaseId}`);
  const updated = await db.reviewCases.update(rc.id, { status: decision });
  await recordEvent(ctx, rc.id, decision, note);
  await emitAudit(ctx, `review.case.${decision}`, { type: "review_case", id: rc.id }, { note });
  return updated;
}

export async function listReviewCases(ctx: ActorContext, status?: ReviewCase["status"]): Promise<ReviewCase[]> {
  return (await db.reviewCases
    .list(ctx.tenantId, status ? (c) => c.status === status : undefined))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function recordEvent(
  ctx: ActorContext,
  reviewCaseId: string,
  kind: ReviewCaseEvent["kind"],
  note?: string,
): Promise<void> {
  await db.reviewCaseEvents.insert({
    id: id("revevt"),
    tenantId: ctx.tenantId,
    reviewCaseId,
    actorUserId: ctx.actorUserId ?? null,
    kind,
    note: note ?? null,
    createdAt: now(),
  });
}
