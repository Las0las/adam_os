// IOS-014 — Benchmark Harness — canonical benchmark events.
//
// Published onto the shared Execution Event Bus (IOS-005). Immutable; carry run/
// case identity and scoring/latency, with no prompt/response text.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { BusEvent } from "@/lib/aiops/execution/observability/execution-event-bus";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type BenchmarkEventType =
  | "benchmark.run_started"
  | "benchmark.case_started"
  | "benchmark.case_completed"
  | "benchmark.case_failed"
  | "benchmark.run_completed"
  | "benchmark.run_failed";

export interface BenchmarkEventBase extends BusEvent {
  type: BenchmarkEventType;
  runId: string;
  suiteId: string;
}

export interface BenchmarkRunStartedEvent extends BenchmarkEventBase { type: "benchmark.run_started"; caseCount: number }
export interface BenchmarkCaseStartedEvent extends BenchmarkEventBase { type: "benchmark.case_started"; caseId: string }
export interface BenchmarkCaseCompletedEvent extends BenchmarkEventBase {
  type: "benchmark.case_completed";
  caseId: string;
  score: number;
  latencyMs: number;
}
export interface BenchmarkCaseFailedEvent extends BenchmarkEventBase {
  type: "benchmark.case_failed";
  caseId: string;
  reason: string;
}
export interface BenchmarkRunCompletedEvent extends BenchmarkEventBase { type: "benchmark.run_completed"; cases: number; successes: number }
export interface BenchmarkRunFailedEvent extends BenchmarkEventBase { type: "benchmark.run_failed"; reason: string }

export type BenchmarkEvent =
  | BenchmarkRunStartedEvent
  | BenchmarkCaseStartedEvent
  | BenchmarkCaseCompletedEvent
  | BenchmarkCaseFailedEvent
  | BenchmarkRunCompletedEvent
  | BenchmarkRunFailedEvent;

export function isBenchmarkEvent(event: { type: string }): event is BenchmarkEvent {
  return event.type.startsWith("benchmark.");
}

/** Identity shared by every event of a run. */
export interface BenchmarkRunRef {
  runId: string;
  suiteId: string;
  provider: string;
  model: string;
  workloadType: string;
}

function base(type: BenchmarkEventType, ref: BenchmarkRunRef): BenchmarkEventBase {
  return {
    type,
    executionId: ref.runId,
    requestId: ref.runId,
    tenantId: null,
    provider: ref.provider,
    model: ref.model,
    workloadType: ref.workloadType,
    timestamp: observedNowMs(),
    runId: ref.runId,
    suiteId: ref.suiteId,
  };
}

export function benchmarkRunStarted(ref: BenchmarkRunRef, caseCount: number): BenchmarkRunStartedEvent {
  return deepFreeze({ ...base("benchmark.run_started", ref), type: "benchmark.run_started" as const, caseCount });
}
export function benchmarkCaseStarted(ref: BenchmarkRunRef, caseId: string): BenchmarkCaseStartedEvent {
  return deepFreeze({ ...base("benchmark.case_started", ref), type: "benchmark.case_started" as const, caseId });
}
export function benchmarkCaseCompleted(ref: BenchmarkRunRef, caseId: string, score: number, latencyMs: number): BenchmarkCaseCompletedEvent {
  return deepFreeze({ ...base("benchmark.case_completed", ref), type: "benchmark.case_completed" as const, caseId, score, latencyMs });
}
export function benchmarkCaseFailed(ref: BenchmarkRunRef, caseId: string, reason: string): BenchmarkCaseFailedEvent {
  return deepFreeze({ ...base("benchmark.case_failed", ref), type: "benchmark.case_failed" as const, caseId, reason });
}
export function benchmarkRunCompleted(ref: BenchmarkRunRef, cases: number, successes: number): BenchmarkRunCompletedEvent {
  return deepFreeze({ ...base("benchmark.run_completed", ref), type: "benchmark.run_completed" as const, cases, successes });
}
export function benchmarkRunFailed(ref: BenchmarkRunRef, reason: string): BenchmarkRunFailedEvent {
  return deepFreeze({ ...base("benchmark.run_failed", ref), type: "benchmark.run_failed" as const, reason });
}
