// Phase 7 — learning signal store. Signals are explicit, auditable records of
// "something should change". They are created from evals/feedback/outcomes and
// never auto-applied; a human reviews and approves any resulting change.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import type {
  LearningSignal,
  LearningSignalSeverity,
  LearningSignalStatus,
  LearningSignalType,
} from "./learning-types";

export interface CreateLearningSignalInput {
  signalType: LearningSignalType;
  severity?: LearningSignalSeverity;
  summary: string;
  componentType?: string | null;
  componentKey?: string | null;
  domain?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  evidence?: Array<Record<string, unknown>>;
  recommendedChange?: Record<string, unknown>;
  createdFromFeedbackId?: string | null;
  createdFromEvalRunId?: string | null;
}

export async function createLearningSignal(
  ctx: ActorContext,
  input: CreateLearningSignalInput,
): Promise<LearningSignal> {
  const signal = await db.learningSignals.insert({
    id: id("lsig"),
    tenantId: ctx.tenantId,
    signalType: input.signalType,
    componentType: input.componentType ?? null,
    componentKey: input.componentKey ?? null,
    domain: input.domain ?? null,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    severity: input.severity ?? "medium",
    summary: input.summary,
    evidence: input.evidence ?? [],
    recommendedChange: input.recommendedChange ?? {},
    status: "open",
    createdFromFeedbackId: input.createdFromFeedbackId ?? null,
    createdFromEvalRunId: input.createdFromEvalRunId ?? null,
    linkedReleaseBundleId: null,
    createdAt: now(),
    reviewedAt: null,
  });
  await emitAudit(ctx, "learning.signal.created", { type: "learning_signal", id: signal.id }, {
    signalType: input.signalType,
    severity: signal.severity,
  });
  return signal;
}

export async function listLearningSignals(
  tenantId: string,
  filters: { status?: LearningSignalStatus; severity?: LearningSignalSeverity } = {},
): Promise<LearningSignal[]> {
  return (
    await db.learningSignals.list(tenantId, (s) => {
      if (filters.status && s.status !== filters.status) return false;
      if (filters.severity && s.severity !== filters.severity) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLearningSignal(
  tenantId: string,
  signalId: string,
): Promise<LearningSignal | undefined> {
  return await db.learningSignals.get(tenantId, signalId);
}

/** Find an existing open signal matching a dedupe key (type + component). */
export async function findOpenSignal(
  tenantId: string,
  signalType: LearningSignalType,
  componentKey: string | null | undefined,
): Promise<LearningSignal | undefined> {
  return await db.learningSignals.find(
    tenantId,
    (s) => s.status === "open" && s.signalType === signalType && (s.componentKey ?? null) === (componentKey ?? null),
  );
}
