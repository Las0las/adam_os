// Execution Observability — canonical execution events (Milestone 5.0,
// enriched in Milestone 5.5 for the event bus).
//
// Every inference flowing through the pipeline emits exactly one terminal event:
//   BeforeExecute   → ExecutionStarted
//   AfterExecute    → ExecutionCompleted
//   ExecutionFailed → ExecutionFailed
//
// Events are immutable, serializable, provider-agnostic, and SELF-DESCRIBING:
// they carry everything a subscriber needs (routing decision, request/response
// fingerprints, timing, usage, normalized error) so subscribers depend only on
// the event — never on the execution context, the raw provider response, or each
// other. The event is the single vocabulary the bus speaks.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { isRetryable, type NormalizedExecutionError, type ExecutionError } from "../execution-errors";
import type {
  InferenceExecutionContext,
  InferenceExecutionResult,
} from "../execution-types";
import { fingerprint } from "./fingerprint";
import { observedNowMs } from "./observability-clock";

export type ExecutionEventType =
  | "execution.started"
  | "execution.completed"
  | "execution.failed";

/** Fields shared by every execution event. */
export interface ExecutionEventBase {
  type: ExecutionEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  /** The routing decision that produced this execution, or null for the
   *  already-resolved-provider path. */
  routingDecision: RoutingDecision | null;
  /** Stable digest of the request (identity without retaining prompt text). */
  requestFingerprint: string;
  /** Execution start time (`ctx.startTime`, epoch ms). */
  startTime: number;
  /** When this event was emitted (epoch ms, wall clock). */
  timestamp: number;
}

export interface ExecutionStartedEvent extends ExecutionEventBase {
  type: "execution.started";
}

export interface ExecutionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface ExecutionCompletedEvent extends ExecutionEventBase {
  type: "execution.completed";
  latency: number;
  usage: ExecutionUsage | null;
  finishReason: string | null;
  /** Stable digest of the response (identity without retaining response text). */
  responseFingerprint: string;
}

export interface ExecutionFailedEvent extends ExecutionEventBase {
  type: "execution.failed";
  latency: number;
  error: NormalizedExecutionError;
  retryable: boolean;
  /** Stable digest of the normalized error. */
  responseFingerprint: string;
}

export type ExecutionEvent =
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent;

function base(
  type: ExecutionEventType,
  ctx: InferenceExecutionContext,
): ExecutionEventBase {
  return {
    type,
    executionId: ctx.executionId,
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    provider: ctx.provider,
    model: ctx.model,
    workloadType: ctx.workloadType,
    routingDecision: ctx.routingDecision,
    requestFingerprint: ctx.requestFingerprint,
    startTime: ctx.startTime,
    timestamp: observedNowMs(),
  };
}

export function executionStarted(ctx: InferenceExecutionContext): ExecutionStartedEvent {
  return deepFreeze({ ...base("execution.started", ctx), type: "execution.started" as const });
}

export function executionCompleted(
  ctx: InferenceExecutionContext,
  result: InferenceExecutionResult,
): ExecutionCompletedEvent {
  const usage: ExecutionUsage | null = result.usage
    ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.promptTokens + result.usage.completionTokens,
        costUsd: result.usage.costUsd,
      }
    : null;
  return deepFreeze({
    ...base("execution.completed", ctx),
    type: "execution.completed" as const,
    latency: result.latency,
    usage,
    finishReason: result.finishReason,
    responseFingerprint: fingerprint({ text: result.response, json: result.json }),
  });
}

export function executionFailed(
  ctx: InferenceExecutionContext,
  error: ExecutionError,
): ExecutionFailedEvent {
  const normalized: NormalizedExecutionError = { kind: error.kind, name: error.name, message: error.message };
  return deepFreeze({
    ...base("execution.failed", ctx),
    type: "execution.failed" as const,
    latency: observedNowMs() - ctx.startTime,
    error: normalized,
    retryable: isRetryable(error.kind),
    responseFingerprint: fingerprint({ error: normalized }),
  });
}
