// IOS-009 — Semantic Cache — canonical semantic events.
//
// Published onto the shared Execution Event Bus (IOS-005). These are a NEW event
// family (semantic.*) carrying similarity detail — they do NOT replace the
// canonical cache.* events, which the CacheManager still publishes for the
// "semantic" store (so per-store cache metrics continue to work). Immutable; no
// prompt/response text — only a compatibility-key digest and similarity scores.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type SemanticEventType =
  | "semantic.hit"
  | "semantic.miss"
  | "semantic.stored";

export interface SemanticEventBase {
  type: SemanticEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
  /** Digest of the compatibility key (provider|model|workload|responseFormat). */
  compatDigest: string;
}

export interface SemanticHitEvent extends SemanticEventBase {
  type: "semantic.hit";
  similarity: number;
  threshold: number;
}
export interface SemanticMissEvent extends SemanticEventBase {
  type: "semantic.miss";
  /** Best similarity found below the threshold (0 when no candidate). */
  bestSimilarity: number;
  threshold: number;
}
export interface SemanticStoredEvent extends SemanticEventBase {
  type: "semantic.stored";
  entryCount: number;
}

export type SemanticEvent = SemanticHitEvent | SemanticMissEvent | SemanticStoredEvent;

export function isSemanticEvent(event: { type: string }): event is SemanticEvent {
  return event.type.startsWith("semantic.");
}

function base(type: SemanticEventType, ctx: InferenceExecutionContext, compatDigest: string): SemanticEventBase {
  return {
    type,
    executionId: ctx.executionId,
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    provider: ctx.provider,
    model: ctx.model,
    workloadType: ctx.workloadType,
    timestamp: observedNowMs(),
    compatDigest,
  };
}

export function semanticHit(ctx: InferenceExecutionContext, compatDigest: string, similarity: number, threshold: number): SemanticHitEvent {
  return deepFreeze({ ...base("semantic.hit", ctx, compatDigest), type: "semantic.hit" as const, similarity, threshold });
}
export function semanticMiss(ctx: InferenceExecutionContext, compatDigest: string, bestSimilarity: number, threshold: number): SemanticMissEvent {
  return deepFreeze({ ...base("semantic.miss", ctx, compatDigest), type: "semantic.miss" as const, bestSimilarity, threshold });
}
export function semanticStored(ctx: InferenceExecutionContext, compatDigest: string, entryCount: number): SemanticStoredEvent {
  return deepFreeze({ ...base("semantic.stored", ctx, compatDigest), type: "semantic.stored" as const, entryCount });
}
