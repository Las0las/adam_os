// Execution Observability (Milestone 5.0, deliverable #4; reworked in 5.5).
//
// Defines the canonical, IMMUTABLE audit record and the engine that builds one
// per execution. Since Milestone 5.5 the engine is a BUS SUBSCRIBER: it builds
// the record from the canonical event (which already carries the routing
// decision, request/response fingerprints, usage, and normalized error) rather
// than from the execution context/result. There is NO persistence and NO
// encryption — only the canonical structure and its construction. Observation
// only.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import type { NormalizedExecutionError } from "../execution-errors";
import {
  isExecutionEvent,
  type ExecutionCompletedEvent,
  type ExecutionFailedEvent,
} from "./execution-events";
import type { BusEvent, ExecutionEventSubscriber } from "./execution-event-bus";
import { observedNowMs } from "./observability-clock";

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
  /** Pipeline start time (`event.startTime`). */
  startedAt: number;
  /** When this audit record was sealed. */
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

/** Project a terminal event onto the audited result shape. */
function auditedResult(event: ExecutionCompletedEvent | ExecutionFailedEvent): AuditedExecutionResult {
  if (event.type === "execution.completed") {
    return {
      success: true,
      latency: event.latency,
      finishReason: event.finishReason,
      promptTokens: event.usage?.promptTokens ?? null,
      completionTokens: event.usage?.completionTokens ?? null,
      costUsd: event.usage?.costUsd ?? null,
      error: null,
    };
  }
  // execution.failed
  return {
    success: false,
    latency: event.latency,
    finishReason: null,
    promptTokens: null,
    completionTokens: null,
    costUsd: null,
    error: event.error,
  };
}

/** Builds immutable audit records from terminal execution events. */
export class ExecutionAuditEngine implements ExecutionEventSubscriber {
  readonly name = "audit";

  private readonly records_: AuditRecord[] = [];
  private readonly capacity: number;

  constructor(capacity = 1000) {
    this.capacity = Math.max(1, capacity);
  }

  onEvent(event: BusEvent): void {
    // Audit every terminal execution outcome; ignore non-execution (security)
    // events and `started` (which carries no result to audit).
    if (!isExecutionEvent(event) || event.type === "execution.started") return;
    const record: AuditRecord = deepFreeze({
      executionId: event.executionId,
      requestId: event.requestId,
      tenantId: event.tenantId,
      routingDecision: event.routingDecision,
      selectedProvider: event.provider,
      selectedModel: event.model,
      requestFingerprint: event.requestFingerprint,
      responseFingerprint: event.responseFingerprint,
      executionResult: auditedResult(event),
      timestamps: { startedAt: event.startTime, recordedAt: observedNowMs() },
    });
    this.records_.push(record);
    if (this.records_.length > this.capacity) this.records_.shift();
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
}
