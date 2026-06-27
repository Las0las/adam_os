// IOS-016 — Traffic Replay Engine — canonical events.
//
// Published onto the REPLAY-SCOPED event bus (never the production bus), so replay
// observation cannot contaminate production health/metrics. Immutable.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { BusEvent } from "@/lib/aiops/execution/observability/execution-event-bus";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import { REPLAY_TENANT } from "./replay-types";

export type ReplayEventType =
  | "replay.run_started"
  | "replay.record_started"
  | "replay.record_completed"
  | "replay.record_failed"
  | "replay.run_completed";

export interface ReplayEventBase extends BusEvent {
  type: ReplayEventType;
  replayId: string;
}

export interface ReplayRunStartedEvent extends ReplayEventBase { type: "replay.run_started"; recordCount: number }
export interface ReplayRecordStartedEvent extends ReplayEventBase { type: "replay.record_started"; recordId: string }
export interface ReplayRecordCompletedEvent extends ReplayEventBase { type: "replay.record_completed"; recordId: string; latencyMs: number }
export interface ReplayRecordFailedEvent extends ReplayEventBase { type: "replay.record_failed"; recordId: string; reason: string }
export interface ReplayRunCompletedEvent extends ReplayEventBase { type: "replay.run_completed"; records: number; successes: number }

export type ReplayEvent =
  | ReplayRunStartedEvent
  | ReplayRecordStartedEvent
  | ReplayRecordCompletedEvent
  | ReplayRecordFailedEvent
  | ReplayRunCompletedEvent;

export function isReplayEvent(event: { type: string }): event is ReplayEvent {
  return event.type.startsWith("replay.");
}

export interface ReplayRunRef {
  replayId: string;
  provider: string;
  model: string;
  workloadType: string;
}

function base(type: ReplayEventType, ref: ReplayRunRef): ReplayEventBase {
  return {
    type,
    executionId: ref.replayId,
    requestId: ref.replayId,
    tenantId: REPLAY_TENANT,
    provider: ref.provider,
    model: ref.model,
    workloadType: ref.workloadType,
    timestamp: observedNowMs(),
    replayId: ref.replayId,
  };
}

export function replayRunStarted(ref: ReplayRunRef, recordCount: number): ReplayRunStartedEvent {
  return deepFreeze({ ...base("replay.run_started", ref), type: "replay.run_started" as const, recordCount });
}
export function replayRecordStarted(ref: ReplayRunRef, recordId: string): ReplayRecordStartedEvent {
  return deepFreeze({ ...base("replay.record_started", ref), type: "replay.record_started" as const, recordId });
}
export function replayRecordCompleted(ref: ReplayRunRef, recordId: string, latencyMs: number): ReplayRecordCompletedEvent {
  return deepFreeze({ ...base("replay.record_completed", ref), type: "replay.record_completed" as const, recordId, latencyMs });
}
export function replayRecordFailed(ref: ReplayRunRef, recordId: string, reason: string): ReplayRecordFailedEvent {
  return deepFreeze({ ...base("replay.record_failed", ref), type: "replay.record_failed" as const, recordId, reason });
}
export function replayRunCompleted(ref: ReplayRunRef, records: number, successes: number): ReplayRunCompletedEvent {
  return deepFreeze({ ...base("replay.run_completed", ref), type: "replay.run_completed" as const, records, successes });
}
