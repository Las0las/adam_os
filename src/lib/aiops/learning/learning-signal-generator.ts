// Phase 7 — learning signal generator. Turns measurable problems (eval
// regressions/low scores, repeated human corrections, recommendation overrides,
// citation issues, repeated action failures) into deduped learning signals.
// Pure-ish: it reads the captured records and emits signals; it never changes
// production.

import { db } from "@/lib/lawrence-core/db";
import { createLearningSignal, findOpenSignal } from "./learning-signal-service";
import type { ActorContext } from "@/types/platform";
import type { EvalRun } from "@/types/aiops";
import type { HumanFeedback, LearningSignal } from "./learning-types";

const REPEAT_THRESHOLD = 2; // >= N repeated corrections/overrides -> signal

/** From an eval run that regressed or scored low, raise a gap signal. */
export async function generateFromEvalRun(
  ctx: ActorContext,
  run: EvalRun,
): Promise<LearningSignal | null> {
  const lowScore = run.score < 0.6;
  if (!run.regressionDetected && !lowScore) return null;

  const signalType =
    run.suiteType === "retrieval"
      ? "retrieval_gap"
      : run.suiteType === "extraction"
        ? "extraction_gap"
        : run.suiteType === "response"
          ? "prompt_gap"
          : "policy_gap";

  const componentKey = run.targetComponentKey ?? null;
  if (await findOpenSignal(ctx.tenantId, signalType, componentKey)) return null;

  return await createLearningSignal(ctx, {
    signalType,
    severity: run.regressionDetected ? "high" : "medium",
    summary: `${run.suiteType} eval ${run.regressionDetected ? "regressed" : "scored low"} (score ${run.score.toFixed(2)})`,
    componentType: run.targetComponentType ?? null,
    componentKey,
    evidence: [{ evalRunId: run.id, score: run.score, regressionDetected: run.regressionDetected }],
    recommendedChange: { kind: "review_component", suiteType: run.suiteType },
    createdFromEvalRunId: run.id,
  });
}

/**
 * From human feedback, raise a signal when corrections/overrides repeat or a
 * single severe issue (bad citation) is reported.
 */
export async function generateFromFeedback(
  ctx: ActorContext,
  feedback: HumanFeedback,
): Promise<LearningSignal | null> {
  const all = await db.humanFeedback.list(ctx.tenantId);

  if (feedback.feedbackType === "citation_issue") {
    if (await findOpenSignal(ctx.tenantId, "policy_gap", feedback.objectType ?? null)) return null;
    return await createLearningSignal(ctx, {
      signalType: "policy_gap",
      severity: "high",
      summary: `Citation issue reported on ${feedback.subjectType} ${feedback.subjectId}`,
      objectType: feedback.objectType ?? null,
      objectId: feedback.objectId ?? null,
      evidence: [{ feedbackId: feedback.id, comment: feedback.comment ?? null }],
      recommendedChange: { kind: "review_grounding" },
      createdFromFeedbackId: feedback.id,
    });
  }

  if (feedback.feedbackType === "extraction_correction") {
    const repeats = all.filter(
      (f) =>
        f.feedbackType === "extraction_correction" &&
        (f.objectType ?? null) === (feedback.objectType ?? null),
    ).length;
    if (repeats < REPEAT_THRESHOLD) return null;
    if (await findOpenSignal(ctx.tenantId, "extraction_gap", feedback.objectType ?? null)) return null;
    return await createLearningSignal(ctx, {
      signalType: "extraction_gap",
      severity: "medium",
      summary: `Repeated extraction corrections (${repeats}) for ${feedback.objectType ?? "object"}`,
      objectType: feedback.objectType ?? null,
      evidence: all
        .filter((f) => f.feedbackType === "extraction_correction")
        .map((f) => ({ feedbackId: f.id, correction: f.correction ?? null })),
      recommendedChange: { kind: "improve_extraction_prompt" },
      createdFromFeedbackId: feedback.id,
    });
  }

  if (feedback.feedbackType === "answer_rating" && (feedback.rating ?? 5) <= 2) {
    const lowRatings = all.filter(
      (f) => f.feedbackType === "answer_rating" && (f.rating ?? 5) <= 2,
    ).length;
    if (lowRatings < REPEAT_THRESHOLD) return null;
    if (await findOpenSignal(ctx.tenantId, "prompt_gap", feedback.subjectType)) return null;
    return await createLearningSignal(ctx, {
      signalType: "prompt_gap",
      severity: "medium",
      summary: `Repeated low answer ratings (${lowRatings})`,
      componentKey: feedback.subjectType,
      evidence: [{ feedbackId: feedback.id, rating: feedback.rating }],
      recommendedChange: { kind: "improve_response_prompt" },
      createdFromFeedbackId: feedback.id,
    });
  }

  return null;
}

/** From repeated recommendation overrides, raise a ranking signal. */
export async function generateFromRecommendationOverrides(
  ctx: ActorContext,
  objectType: string | null,
): Promise<LearningSignal | null> {
  const outcomes = await db.recommendationOutcomes.list(
    ctx.tenantId,
    (o) => (o.objectType ?? null) === (objectType ?? null),
  );
  const overrides = outcomes.filter((o) => o.decision === "rejected" || o.decision === "modified");
  if (overrides.length < REPEAT_THRESHOLD) return null;
  if (await findOpenSignal(ctx.tenantId, "ranking_signal", objectType)) return null;
  return await createLearningSignal(ctx, {
    signalType: "ranking_signal",
    severity: "medium",
    summary: `Recommendations for ${objectType ?? "object"} overridden ${overrides.length} times`,
    objectType,
    evidence: overrides.map((o) => ({ outcomeId: o.id, decision: o.decision })),
    recommendedChange: { kind: "retune_recommendation_ranking" },
  });
}
