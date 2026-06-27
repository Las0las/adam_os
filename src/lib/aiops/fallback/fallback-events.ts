// IOS-012 — Fallback Orchestrator — canonical fallback events.
//
// Published onto the shared Execution Event Bus (IOS-005). Immutable; carry the
// primary provider/model and the alternate target, with no prompt/response text.

import { deepFreeze, type ExecutionTarget } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type FallbackEventType =
  | "fallback.started"
  | "fallback.attempt"
  | "fallback.succeeded"
  | "fallback.exhausted"
  | "fallback.bypassed";

export interface FallbackEventBase {
  type: FallbackEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  /** The primary (routing-selected) provider/model the execution started on. */
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
}

export interface FallbackStartedEvent extends FallbackEventBase {
  type: "fallback.started";
  /** Normalized kind of the primary failure that triggered fallback. */
  failureKind: ExecutionErrorKind;
}
export interface FallbackAttemptEvent extends FallbackEventBase {
  type: "fallback.attempt";
  targetProvider: string;
  targetModel: string;
  attempt: number;
}
export interface FallbackSucceededEvent extends FallbackEventBase {
  type: "fallback.succeeded";
  targetProvider: string;
  targetModel: string;
  attempt: number;
  latencyMs: number;
}
export interface FallbackExhaustedEvent extends FallbackEventBase {
  type: "fallback.exhausted";
  attempts: number;
  latencyMs: number;
}
export interface FallbackBypassedEvent extends FallbackEventBase { type: "fallback.bypassed" }

export type FallbackEvent =
  | FallbackStartedEvent
  | FallbackAttemptEvent
  | FallbackSucceededEvent
  | FallbackExhaustedEvent
  | FallbackBypassedEvent;

export function isFallbackEvent(event: { type: string }): event is FallbackEvent {
  return event.type.startsWith("fallback.");
}

function base(type: FallbackEventType, ctx: InferenceExecutionContext): FallbackEventBase {
  return {
    type,
    executionId: ctx.executionId,
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    provider: ctx.provider,
    model: ctx.model,
    workloadType: ctx.workloadType,
    timestamp: observedNowMs(),
  };
}

export function fallbackStarted(ctx: InferenceExecutionContext, failureKind: ExecutionErrorKind): FallbackStartedEvent {
  return deepFreeze({ ...base("fallback.started", ctx), type: "fallback.started" as const, failureKind });
}
export function fallbackAttempt(ctx: InferenceExecutionContext, target: ExecutionTarget, attempt: number): FallbackAttemptEvent {
  return deepFreeze({
    ...base("fallback.attempt", ctx), type: "fallback.attempt" as const,
    targetProvider: target.provider, targetModel: target.model, attempt,
  });
}
export function fallbackSucceeded(ctx: InferenceExecutionContext, target: ExecutionTarget, attempt: number, latencyMs: number): FallbackSucceededEvent {
  return deepFreeze({
    ...base("fallback.succeeded", ctx), type: "fallback.succeeded" as const,
    targetProvider: target.provider, targetModel: target.model, attempt, latencyMs,
  });
}
export function fallbackExhausted(ctx: InferenceExecutionContext, attempts: number, latencyMs: number): FallbackExhaustedEvent {
  return deepFreeze({ ...base("fallback.exhausted", ctx), type: "fallback.exhausted" as const, attempts, latencyMs });
}
export function fallbackBypassed(ctx: InferenceExecutionContext): FallbackBypassedEvent {
  return deepFreeze({ ...base("fallback.bypassed", ctx), type: "fallback.bypassed" as const });
}
