// Phase 7 — human feedback capture. Every rating/correction/override is an
// auditable record. Recording feedback may emit a learning signal (deduped),
// but never changes production directly.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { generateFromFeedback } from "./learning-signal-generator";
import type { ActorContext } from "@/types/platform";
import type { FeedbackType, HumanFeedback, LearningSignal } from "./learning-types";

export interface RecordFeedbackInput {
  feedbackType: FeedbackType;
  subjectType: string;
  subjectId: string;
  objectType?: string | null;
  objectId?: string | null;
  rating?: number | null;
  label?: string | null;
  comment?: string | null;
  correction?: Record<string, unknown> | null;
}

export async function recordFeedback(
  ctx: ActorContext,
  input: RecordFeedbackInput,
): Promise<{ feedback: HumanFeedback; signal: LearningSignal | null }> {
  const feedback = await db.humanFeedback.insert({
    id: id("fbk"),
    tenantId: ctx.tenantId,
    feedbackType: input.feedbackType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    rating: input.rating ?? null,
    label: input.label ?? null,
    comment: input.comment ?? null,
    correction: input.correction ?? null,
    actorUserId: ctx.actorUserId ?? null,
    createdAt: now(),
  });

  await emitAudit(ctx, "learning.feedback.recorded", { type: "human_feedback", id: feedback.id }, {
    feedbackType: input.feedbackType,
    subjectType: input.subjectType,
  });

  const signal = await generateFromFeedback(ctx, feedback);
  return { feedback, signal };
}

export async function listFeedback(
  tenantId: string,
  filters: { feedbackType?: FeedbackType; subjectType?: string; subjectId?: string } = {},
): Promise<HumanFeedback[]> {
  return (
    await db.humanFeedback.list(tenantId, (f) => {
      if (filters.feedbackType && f.feedbackType !== filters.feedbackType) return false;
      if (filters.subjectType && f.subjectType !== filters.subjectType) return false;
      if (filters.subjectId && f.subjectId !== filters.subjectId) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getFeedbackSummary(
  tenantId: string,
): Promise<{ total: number; byType: Record<string, number>; averageRating: number | null }> {
  const all = await db.humanFeedback.list(tenantId);
  const byType: Record<string, number> = {};
  let ratingSum = 0;
  let ratingN = 0;
  for (const f of all) {
    byType[f.feedbackType] = (byType[f.feedbackType] ?? 0) + 1;
    if (typeof f.rating === "number") {
      ratingSum += f.rating;
      ratingN += 1;
    }
  }
  return { total: all.length, byType, averageRating: ratingN ? ratingSum / ratingN : null };
}
