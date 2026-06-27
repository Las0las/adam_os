// IOS-008 — Batch Scheduler — canonical batch events.
//
// Published onto the shared Execution Event Bus (IOS-005) so batch activity is
// observable through telemetry/audit and counted by the passive batch metrics
// collector. Events are immutable and carry no prompt/response text.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type BatchEventType =
  | "batch.created"
  | "batch.queued"
  | "batch.dispatched"
  | "batch.completed"
  | "batch.expired"
  | "batch.bypassed";

export interface BatchEventBase {
  type: BatchEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
  /** Compatibility-key digest grouping requests in a batch ("" for bypassed). */
  batchKeyDigest: string;
}

export interface BatchCreatedEvent extends BatchEventBase { type: "batch.created" }
export interface BatchQueuedEvent extends BatchEventBase {
  type: "batch.queued";
  /** Position of this request within its forming batch (1-based). */
  position: number;
}
export interface BatchDispatchedEvent extends BatchEventBase {
  type: "batch.dispatched";
  reason: "size" | "timeout";
  batchSize: number;
  capacity: number;
  /** Time (ms) the batch waited from creation to dispatch. */
  waitMs: number;
}
export interface BatchCompletedEvent extends BatchEventBase {
  type: "batch.completed";
  batchSize: number;
}
export interface BatchExpiredEvent extends BatchEventBase {
  type: "batch.expired";
  batchSize: number;
  waitMs: number;
}
export interface BatchBypassedEvent extends BatchEventBase {
  type: "batch.bypassed";
  reason: "bypass" | "ineligible";
}

export type BatchEvent =
  | BatchCreatedEvent
  | BatchQueuedEvent
  | BatchDispatchedEvent
  | BatchCompletedEvent
  | BatchExpiredEvent
  | BatchBypassedEvent;

export function isBatchEvent(event: { type: string }): event is BatchEvent {
  return event.type.startsWith("batch.");
}

function base(type: BatchEventType, ctx: InferenceExecutionContext, batchKeyDigest: string): BatchEventBase {
  return {
    type,
    executionId: ctx.executionId,
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    provider: ctx.provider,
    model: ctx.model,
    workloadType: ctx.workloadType,
    timestamp: observedNowMs(),
    batchKeyDigest,
  };
}

export function batchCreated(ctx: InferenceExecutionContext, digest: string): BatchCreatedEvent {
  return deepFreeze({ ...base("batch.created", ctx, digest), type: "batch.created" as const });
}
export function batchQueued(ctx: InferenceExecutionContext, digest: string, position: number): BatchQueuedEvent {
  return deepFreeze({ ...base("batch.queued", ctx, digest), type: "batch.queued" as const, position });
}
export function batchDispatched(ctx: InferenceExecutionContext, digest: string, reason: "size" | "timeout", batchSize: number, capacity: number, waitMs: number): BatchDispatchedEvent {
  return deepFreeze({ ...base("batch.dispatched", ctx, digest), type: "batch.dispatched" as const, reason, batchSize, capacity, waitMs });
}
export function batchCompleted(ctx: InferenceExecutionContext, digest: string, batchSize: number): BatchCompletedEvent {
  return deepFreeze({ ...base("batch.completed", ctx, digest), type: "batch.completed" as const, batchSize });
}
export function batchExpired(ctx: InferenceExecutionContext, digest: string, batchSize: number, waitMs: number): BatchExpiredEvent {
  return deepFreeze({ ...base("batch.expired", ctx, digest), type: "batch.expired" as const, batchSize, waitMs });
}
export function batchBypassed(ctx: InferenceExecutionContext, reason: "bypass" | "ineligible"): BatchBypassedEvent {
  return deepFreeze({ ...base("batch.bypassed", ctx, ""), type: "batch.bypassed" as const, reason });
}
