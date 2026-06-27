// IOS-015 — Explainability Engine — canonical event.
//
// Published onto the shared Execution Event Bus (IOS-005) when an Explanation is
// produced. Immutable; carries the Explanation. No prompt/response text.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { BusEvent } from "@/lib/aiops/execution/observability/execution-event-bus";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { Explanation } from "./explainability-types";

export type ExplanationEventType = "explanation.produced";

export interface ExplanationProducedEvent extends BusEvent {
  type: "explanation.produced";
  explanation: Explanation;
}

export type ExplanationEvent = ExplanationProducedEvent;

export function isExplanationEvent(event: { type: string }): event is ExplanationEvent {
  return event.type.startsWith("explanation.");
}

export function explanationProduced(explanation: Explanation): ExplanationProducedEvent {
  return deepFreeze({
    type: "explanation.produced" as const,
    executionId: explanation.executionId,
    requestId: explanation.requestId,
    tenantId: explanation.tenantId,
    provider: explanation.provider,
    model: explanation.model,
    workloadType: explanation.workloadType,
    timestamp: observedNowMs(),
    explanation,
  });
}
