// IOS-017 — Evaluation Engine — canonical events.
//
// Published onto the EVALUATION-SCOPED event bus (an Isolated Execution
// Environment, IOS-016 model) — never the production bus — so evaluation never
// contaminates production health/metrics. Immutable.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { BusEvent } from "@/lib/aiops/execution/observability/execution-event-bus";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export const EVALUATION_TENANT = "__evaluation__";

export type EvaluationEventType =
  | "evaluation.started"
  | "evaluation.subject_evaluated"
  | "evaluation.completed";

export interface EvaluationEventBase extends BusEvent {
  type: EvaluationEventType;
  evaluationId: string;
}

export interface EvaluationStartedEvent extends EvaluationEventBase { type: "evaluation.started"; subjects: number }
export interface EvaluationSubjectEvaluatedEvent extends EvaluationEventBase {
  type: "evaluation.subject_evaluated";
  subjectId: string;
  passed: boolean;
  score: number;
}
export interface EvaluationCompletedEvent extends EvaluationEventBase {
  type: "evaluation.completed";
  total: number;
  passed: number;
}

export type EvaluationEvent = EvaluationStartedEvent | EvaluationSubjectEvaluatedEvent | EvaluationCompletedEvent;

export function isEvaluationEvent(event: { type: string }): event is EvaluationEvent {
  return event.type.startsWith("evaluation.");
}

function base(type: EvaluationEventType, evaluationId: string, provider: string, model: string, workloadType: string): EvaluationEventBase {
  return {
    type,
    executionId: evaluationId,
    requestId: evaluationId,
    tenantId: EVALUATION_TENANT,
    provider,
    model,
    workloadType,
    timestamp: observedNowMs(),
    evaluationId,
  };
}

export function evaluationStarted(evaluationId: string, subjects: number): EvaluationStartedEvent {
  return deepFreeze({ ...base("evaluation.started", evaluationId, "", "", "evaluation"), type: "evaluation.started" as const, subjects });
}
export function evaluationSubjectEvaluated(evaluationId: string, provider: string, model: string, workloadType: string, subjectId: string, passed: boolean, score: number): EvaluationSubjectEvaluatedEvent {
  return deepFreeze({ ...base("evaluation.subject_evaluated", evaluationId, provider, model, workloadType), type: "evaluation.subject_evaluated" as const, subjectId, passed, score });
}
export function evaluationCompleted(evaluationId: string, total: number, passed: number): EvaluationCompletedEvent {
  return deepFreeze({ ...base("evaluation.completed", evaluationId, "", "", "evaluation"), type: "evaluation.completed" as const, total, passed });
}
