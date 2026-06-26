// Execution Observability (Milestone 5.0, deliverable #4) — audit engine.
//
// Defines the canonical, IMMUTABLE audit record produced for every execution and
// the middleware that builds it. It records WHAT routing chose, WHICH provider/
// model ran, the request/response fingerprints (identity without retaining text),
// and the normalized result. There is NO persistence and NO encryption in this
// milestone — only the canonical structure and its construction from the
// execution context + result. Observation only.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import type {
  InferenceExecutionContext,
  InferenceExecutionResult,
} from "../execution-types";
import type { ExecutionError, NormalizedExecutionError } from "../execution-errors";
import { fingerprint } from "./fingerprint";
import { observedNowMs } from "./observability-clock";
import {
  guard,
  MIDDLEWARE_PRIORITY,
  type ExecutionMiddleware,
} from "./execution-middleware";

/** Normalized, serializable outcome embedded in the audit record. */
export interface AuditedExecutionResult {
  success: boolean;
  latency: number;
  finishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  error: NormalizedExecutionError | null;
}

/** Wall-clock spans for the audited execution (epoch ms). */
export interface AuditTimestamps {
  /** Pipeline start time (`ctx.startTime`, wall clock). */
  startedAt: number;
  /** When this audit record was sealed (wall clock). */
  recordedAt: number;
}

/** An immutable record of one execution. Deep-frozen on construction. */
export interface AuditRecord {
  executionId: string;
  requestId: string;
  tenantId: string | null;
  routingDecision: RoutingDecision | null;
  selectedProvider: string;
  selectedModel: string;
  requestFingerprint: string;
  responseFingerprint: string;
  executionResult: AuditedExecutionResult;
  timestamps: AuditTimestamps;
}

function auditedResult(result: InferenceExecutionResult): AuditedExecutionResult {
  return {
    success: result.success,
    latency: result.latency,
    finishReason: result.finishReason,
    promptTokens: result.usage?.promptTokens ?? null,
    completionTokens: result.usage?.completionTokens ?? null,
    costUsd: result.usage?.costUsd ?? null,
    error: result.error,
  };
}

function record(
  ctx: InferenceExecutionContext,
  result: InferenceExecutionResult,
  responseFingerprint: string,
): AuditRecord {
  return deepFreeze({
    executionId: ctx.executionId,
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    routingDecision: ctx.routingDecision,
    selectedProvider: ctx.provider,
    selectedModel: ctx.model,
    requestFingerprint: ctx.requestFingerprint,
    responseFingerprint,
    executionResult: auditedResult(result),
    timestamps: { startedAt: ctx.startTime, recordedAt: observedNowMs() },
  });
}

/** Builds immutable audit records as executions complete or fail. */
export class ExecutionAuditEngine implements ExecutionMiddleware {
  readonly name = "audit";
  readonly priority = MIDDLEWARE_PRIORITY.audit;

  private readonly records_: AuditRecord[] = [];
  private readonly capacity: number;

  constructor(capacity = 1000) {
    this.capacity = Math.max(1, capacity);
  }

  /** Audit records, oldest first (a copy). Each element is deep-frozen. */
  records(): AuditRecord[] {
    return [...this.records_];
  }

  last(): AuditRecord | null {
    return this.records_[this.records_.length - 1] ?? null;
  }

  reset(): void {
    this.records_.length = 0;
  }

  private append(rec: AuditRecord): void {
    this.records_.push(rec);
    if (this.records_.length > this.capacity) this.records_.shift();
  }

  afterExecute(ctx: InferenceExecutionContext, result: InferenceExecutionResult): void {
    guard(() => {
      const responseFingerprint = fingerprint({ text: result.response, json: result.json });
      this.append(record(ctx, result, responseFingerprint));
    });
  }

  executionFailed(ctx: InferenceExecutionContext, error: ExecutionError): void {
    guard(() => {
      // A failure produces no response body; synthesize the same normalized
      // result shape the success path records so every execution is audited.
      const failedResult: InferenceExecutionResult = {
        executionId: ctx.executionId,
        provider: ctx.provider,
        model: ctx.model,
        response: null,
        json: null,
        usage: null,
        latency: observedNowMs() - ctx.startTime,
        finishReason: null,
        success: false,
        error: { kind: error.kind, name: error.name, message: error.message },
      };
      const responseFingerprint = fingerprint({ error: failedResult.error });
      this.append(record(ctx, failedResult, responseFingerprint));
    });
  }
}
