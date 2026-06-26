// Security Middleware Platform (Milestone 6.0) — canonical security events.
//
// Security middleware publish these onto the SAME Execution Event Bus the
// telemetry/audit/metrics subscribers already observe, so security actions are
// automatically observable with no new transport. Events are immutable and carry
// the same execution-identity fields as execution events (so they correlate by
// executionId), plus a small security-specific payload. They never carry prompt
// or response text — only structural facts (which rules matched, which PII kinds,
// counts, validation error labels).

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type SecurityEventType =
  | "security.prompt_inspected"
  | "security.pii_detected"
  | "security.pii_masked"
  | "security.validation_succeeded"
  | "security.validation_failed";

/** Fields shared by every security event (mirrors the execution-event identity
 *  fields so the two families correlate on the bus). */
export interface SecurityEventBase {
  type: SecurityEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
}

/** Firewall verdict for one prompt. `allowed` = clean; `flagged` = matched in
 *  detect mode (not blocked); `rejected` = matched in enforce mode (blocked). */
export interface PromptInspectedEvent extends SecurityEventBase {
  type: "security.prompt_inspected";
  outcome: "allowed" | "flagged" | "rejected";
  rules: string[];
}

export interface PiiDetectedEvent extends SecurityEventBase {
  type: "security.pii_detected";
  kinds: string[];
  count: number;
}

export interface PiiMaskedEvent extends SecurityEventBase {
  type: "security.pii_masked";
  kinds: string[];
  count: number;
}

export interface ValidationSucceededEvent extends SecurityEventBase {
  type: "security.validation_succeeded";
}

export interface ValidationFailedEvent extends SecurityEventBase {
  type: "security.validation_failed";
  errors: string[];
}

export type SecurityEvent =
  | PromptInspectedEvent
  | PiiDetectedEvent
  | PiiMaskedEvent
  | ValidationSucceededEvent
  | ValidationFailedEvent;

/** Narrow a bus event to the security-event family. */
export function isSecurityEvent(event: { type: string }): event is SecurityEvent {
  return event.type.startsWith("security.");
}

function base(type: SecurityEventType, ctx: InferenceExecutionContext): SecurityEventBase {
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

export function promptInspected(
  ctx: InferenceExecutionContext,
  outcome: PromptInspectedEvent["outcome"],
  rules: string[],
): PromptInspectedEvent {
  return deepFreeze({ ...base("security.prompt_inspected", ctx), type: "security.prompt_inspected" as const, outcome, rules });
}

export function piiDetected(ctx: InferenceExecutionContext, kinds: string[], count: number): PiiDetectedEvent {
  return deepFreeze({ ...base("security.pii_detected", ctx), type: "security.pii_detected" as const, kinds, count });
}

export function piiMasked(ctx: InferenceExecutionContext, kinds: string[], count: number): PiiMaskedEvent {
  return deepFreeze({ ...base("security.pii_masked", ctx), type: "security.pii_masked" as const, kinds, count });
}

export function validationSucceeded(ctx: InferenceExecutionContext): ValidationSucceededEvent {
  return deepFreeze({ ...base("security.validation_succeeded", ctx), type: "security.validation_succeeded" as const });
}

export function validationFailed(ctx: InferenceExecutionContext, errors: string[]): ValidationFailedEvent {
  return deepFreeze({ ...base("security.validation_failed", ctx), type: "security.validation_failed" as const, errors });
}
