// Phase 7 — recommendation outcome capture. Records whether a recommendation
// was accepted/rejected/etc and its eventual success, and computes acceptance
// rate. Repeated overrides emit a ranking learning signal (deduped).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { generateFromRecommendationOverrides } from "./learning-signal-generator";
import type { ActorContext } from "@/types/platform";
import type {
  LearningSignal,
  OutcomeDecision,
  OutcomeStatus,
  RecommendationOutcome,
} from "./learning-types";

export interface RecordOutcomeInput {
  recommendationObjectId?: string | null;
  sourceRunType?: string | null;
  sourceRunId?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  recommendedActionKey?: string | null;
  decision: OutcomeDecision;
  outcomeStatus?: OutcomeStatus | null;
  rationale?: string | null;
}

export async function recordRecommendationOutcome(
  ctx: ActorContext,
  input: RecordOutcomeInput,
): Promise<{ outcome: RecommendationOutcome; signal: LearningSignal | null }> {
  const outcome = await db.recommendationOutcomes.insert({
    id: id("rout"),
    tenantId: ctx.tenantId,
    recommendationObjectId: input.recommendationObjectId ?? null,
    sourceRunType: input.sourceRunType ?? null,
    sourceRunId: input.sourceRunId ?? null,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    recommendedActionKey: input.recommendedActionKey ?? null,
    decision: input.decision,
    outcomeStatus: input.outcomeStatus ?? null,
    rationale: input.rationale ?? null,
    actorUserId: ctx.actorUserId ?? null,
    decidedAt: now(),
    createdAt: now(),
  });

  await emitAudit(ctx, "learning.recommendation.outcome", { type: "recommendation_outcome", id: outcome.id }, {
    decision: input.decision,
    objectType: input.objectType ?? null,
  });

  let signal: LearningSignal | null = null;
  if (input.decision === "rejected" || input.decision === "modified") {
    signal = await generateFromRecommendationOverrides(ctx, input.objectType ?? null);
  }
  return { outcome, signal };
}

export async function listRecommendationOutcomes(
  tenantId: string,
  filters: { objectType?: string; decision?: OutcomeDecision } = {},
): Promise<RecommendationOutcome[]> {
  return (
    await db.recommendationOutcomes.list(tenantId, (o) => {
      if (filters.objectType && o.objectType !== filters.objectType) return false;
      if (filters.decision && o.decision !== filters.decision) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAcceptanceRate(
  tenantId: string,
  filters: { objectType?: string } = {},
): Promise<{ total: number; accepted: number; acceptanceRate: number }> {
  const outcomes = await listRecommendationOutcomes(tenantId, filters);
  const accepted = outcomes.filter((o) => o.decision === "accepted").length;
  return {
    total: outcomes.length,
    accepted,
    acceptanceRate: outcomes.length ? accepted / outcomes.length : 0,
  };
}
