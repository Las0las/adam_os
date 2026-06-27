// IOS-010 — Retry Policy — canonical retry events.
//
// Published onto the shared Execution Event Bus (IOS-005). Immutable; no
// prompt/response text. Retry attempts live BELOW the execution-event boundary
// (the pipeline still publishes one terminal execution.completed/failed for the
// whole execution); these events expose the retry lifecycle for observability.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type RetryEventType =
  | "retry.started"
  | "retry.attempt"
  | "retry.succeeded"
  | "retry.exhausted"
  | "retry.bypassed";

export interface RetryEventBase {
  type: RetryEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
}

export interface RetryStartedEvent extends RetryEventBase { type: "retry.started"; maxAttempts: number }
export interface RetryAttemptEvent extends RetryEventBase {
  type: "retry.attempt";
  attempt: number;
  errorKind: ExecutionErrorKind;
  retryable: boolean;
  delayMs: number;
}
export interface RetrySucceededEvent extends RetryEventBase {
  type: "retry.succeeded";
  attempts: number;
}
export interface RetryExhaustedEvent extends RetryEventBase {
  type: "retry.exhausted";
  attempts: number;
  errorKind: ExecutionErrorKind;
}
export interface RetryBypassedEvent extends RetryEventBase {
  type: "retry.bypassed";
  reason: "bypass" | "ineligible";
}

export type RetryEvent =
  | RetryStartedEvent
  | RetryAttemptEvent
  | RetrySucceededEvent
  | RetryExhaustedEvent
  | RetryBypassedEvent;

export function isRetryEvent(event: { type: string }): event is RetryEvent {
  return event.type.startsWith("retry.");
}

function base(type: RetryEventType, ctx: InferenceExecutionContext): RetryEventBase {
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

export function retryStarted(ctx: InferenceExecutionContext, maxAttempts: number): RetryStartedEvent {
  return deepFreeze({ ...base("retry.started", ctx), type: "retry.started" as const, maxAttempts });
}
export function retryAttempt(ctx: InferenceExecutionContext, attempt: number, errorKind: ExecutionErrorKind, retryable: boolean, delayMs: number): RetryAttemptEvent {
  return deepFreeze({ ...base("retry.attempt", ctx), type: "retry.attempt" as const, attempt, errorKind, retryable, delayMs });
}
export function retrySucceeded(ctx: InferenceExecutionContext, attempts: number): RetrySucceededEvent {
  return deepFreeze({ ...base("retry.succeeded", ctx), type: "retry.succeeded" as const, attempts });
}
export function retryExhausted(ctx: InferenceExecutionContext, attempts: number, errorKind: ExecutionErrorKind): RetryExhaustedEvent {
  return deepFreeze({ ...base("retry.exhausted", ctx), type: "retry.exhausted" as const, attempts, errorKind });
}
export function retryBypassed(ctx: InferenceExecutionContext, reason: "bypass" | "ineligible"): RetryBypassedEvent {
  return deepFreeze({ ...base("retry.bypassed", ctx), type: "retry.bypassed" as const, reason });
}
