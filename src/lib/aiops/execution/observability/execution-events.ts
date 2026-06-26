// Execution Observability (Milestone 5.0) — canonical execution events.
//
// Every inference flowing through the pipeline emits exactly one terminal event:
//   BeforeExecute   → ExecutionStarted
//   AfterExecute    → ExecutionCompleted
//   ExecutionFailed → ExecutionFailed
//
// Events are immutable, serializable, and provider-agnostic. They are the single
// vocabulary every observer (telemetry, metrics, audit, health) speaks — no
// observer reads raw provider responses or transport errors.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { isRetryable, type NormalizedExecutionError, type ExecutionError } from "../execution-errors";
import type {
  InferenceExecutionContext,
  InferenceExecutionResult,
} from "../execution-types";
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
  /** Epoch milliseconds (wall clock). */
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
}

export interface ExecutionFailedEvent extends ExecutionEventBase {
  type: "execution.failed";
  error: NormalizedExecutionError;
  retryable: boolean;
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
  });
}

export function executionFailed(
  ctx: InferenceExecutionContext,
  error: ExecutionError,
): ExecutionFailedEvent {
  return deepFreeze({
    ...base("execution.failed", ctx),
    type: "execution.failed" as const,
    error: { kind: error.kind, name: error.name, message: error.message },
    retryable: isRetryable(error.kind),
  });
}
