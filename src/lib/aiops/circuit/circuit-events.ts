// IOS-011 — Circuit Breaker — canonical circuit events.
//
// Published onto the shared Execution Event Bus (IOS-005). Immutable; carry a
// circuit-key digest (provider+model) and no prompt/response text.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type CircuitEventType =
  | "circuit.opened"
  | "circuit.closed"
  | "circuit.half_opened"
  | "circuit.rejected";

export interface CircuitEventBase {
  type: CircuitEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
  /** Digest of the circuit key (provider|model). */
  circuitDigest: string;
}

export interface CircuitOpenedEvent extends CircuitEventBase {
  type: "circuit.opened";
  failures: number;
}
export interface CircuitClosedEvent extends CircuitEventBase { type: "circuit.closed" }
export interface CircuitHalfOpenedEvent extends CircuitEventBase { type: "circuit.half_opened" }
export interface CircuitRejectedEvent extends CircuitEventBase { type: "circuit.rejected" }

export type CircuitEvent =
  | CircuitOpenedEvent
  | CircuitClosedEvent
  | CircuitHalfOpenedEvent
  | CircuitRejectedEvent;

export function isCircuitEvent(event: { type: string }): event is CircuitEvent {
  return event.type.startsWith("circuit.");
}

function base(type: CircuitEventType, ctx: InferenceExecutionContext, circuitDigest: string): CircuitEventBase {
  return {
    type,
    executionId: ctx.executionId,
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    provider: ctx.provider,
    model: ctx.model,
    workloadType: ctx.workloadType,
    timestamp: observedNowMs(),
    circuitDigest,
  };
}

export function circuitOpened(ctx: InferenceExecutionContext, digest: string, failures: number): CircuitOpenedEvent {
  return deepFreeze({ ...base("circuit.opened", ctx, digest), type: "circuit.opened" as const, failures });
}
export function circuitClosed(ctx: InferenceExecutionContext, digest: string): CircuitClosedEvent {
  return deepFreeze({ ...base("circuit.closed", ctx, digest), type: "circuit.closed" as const });
}
export function circuitHalfOpened(ctx: InferenceExecutionContext, digest: string): CircuitHalfOpenedEvent {
  return deepFreeze({ ...base("circuit.half_opened", ctx, digest), type: "circuit.half_opened" as const });
}
export function circuitRejected(ctx: InferenceExecutionContext, digest: string): CircuitRejectedEvent {
  return deepFreeze({ ...base("circuit.rejected", ctx, digest), type: "circuit.rejected" as const });
}
