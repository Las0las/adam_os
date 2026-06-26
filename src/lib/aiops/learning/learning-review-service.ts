// Phase 7 — learning review. Humans triage signals: review -> accept/reject ->
// implemented. Accepting can open a review case or a release proposal, but NEVER
// changes production automatically. Every transition is audited.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { getLearningSignal } from "./learning-signal-service";
import type { ActorContext } from "@/types/platform";
import type { LearningSignal } from "./learning-types";

async function load(ctx: ActorContext, signalId: string): Promise<LearningSignal> {
  const signal = await getLearningSignal(ctx.tenantId, signalId);
  if (!signal) throw new Error(`Learning signal not found: ${signalId}`);
  return signal;
}

export async function reviewLearningSignal(
  ctx: ActorContext,
  signalId: string,
): Promise<LearningSignal> {
  requirePermission(ctx, "review.reviewer");
  await load(ctx, signalId);
  const updated = await db.learningSignals.update(signalId, {
    status: "reviewed",
    reviewedAt: now(),
  });
  await emitAudit(ctx, "learning.signal.reviewed", { type: "learning_signal", id: signalId }, {});
  return updated;
}

export async function acceptLearningSignal(
  ctx: ActorContext,
  signalId: string,
  opts: { createReviewCase?: boolean; note?: string } = {},
): Promise<LearningSignal> {
  requirePermission(ctx, "review.reviewer");
  const signal = await load(ctx, signalId);

  // Optionally open a review case to track the change work — not a prod change.
  if (opts.createReviewCase) {
    await openReviewCase(ctx, {
      caseType: `learning_signal:${signal.signalType}`,
      severity: signal.severity === "critical" ? "critical" : "medium",
      summary: signal.summary,
    });
  }

  const updated = await db.learningSignals.update(signalId, {
    status: "accepted",
    reviewedAt: now(),
  });
  await emitAudit(ctx, "learning.signal.accepted", { type: "learning_signal", id: signalId }, {
    signalType: signal.signalType,
    note: opts.note ?? null,
  });
  return updated;
}

export async function rejectLearningSignal(
  ctx: ActorContext,
  signalId: string,
  note?: string,
): Promise<LearningSignal> {
  requirePermission(ctx, "review.reviewer");
  await load(ctx, signalId);
  const updated = await db.learningSignals.update(signalId, {
    status: "rejected",
    reviewedAt: now(),
  });
  await emitAudit(ctx, "learning.signal.rejected", { type: "learning_signal", id: signalId }, {
    note: note ?? null,
  });
  return updated;
}

export async function markLearningSignalImplemented(
  ctx: ActorContext,
  signalId: string,
  opts: { releaseBundleId?: string } = {},
): Promise<LearningSignal> {
  requirePermission(ctx, "review.reviewer");
  await load(ctx, signalId);
  const updated = await db.learningSignals.update(signalId, {
    status: "implemented",
    linkedReleaseBundleId: opts.releaseBundleId ?? null,
  });
  await emitAudit(ctx, "learning.signal.implemented", { type: "learning_signal", id: signalId }, {
    releaseBundleId: opts.releaseBundleId ?? null,
  });
  return updated;
}
