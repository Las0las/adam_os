// IOS-013 — Provider Health Manager — canonical health events.
//
// Published onto the shared Execution Event Bus (IOS-005). Immutable; each carries
// the produced ProviderHealthSnapshot plus the identity of the execution that
// triggered the update (for traceability). No prompt/response text.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { BusEvent } from "@/lib/aiops/execution/observability/execution-event-bus";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ProviderHealthSnapshot } from "./health-types";

export type HealthEventType =
  | "provider_health.updated"
  | "provider_health.degraded"
  | "provider_health.recovered"
  | "provider_health.unavailable";

export interface HealthEventBase extends BusEvent {
  type: HealthEventType;
  /** The immutable snapshot this event reports. */
  health: ProviderHealthSnapshot;
}

export interface ProviderHealthUpdatedEvent extends HealthEventBase { type: "provider_health.updated" }
export interface ProviderDegradedEvent extends HealthEventBase { type: "provider_health.degraded" }
export interface ProviderRecoveredEvent extends HealthEventBase { type: "provider_health.recovered" }
export interface ProviderUnavailableEvent extends HealthEventBase { type: "provider_health.unavailable" }

export type HealthEvent =
  | ProviderHealthUpdatedEvent
  | ProviderDegradedEvent
  | ProviderRecoveredEvent
  | ProviderUnavailableEvent;

export function isHealthEvent(event: { type: string }): event is HealthEvent {
  return event.type.startsWith("provider_health.");
}

/** The triggering event's identity (so health updates are traceable). */
export interface HealthTrigger {
  executionId: string;
  requestId: string;
  tenantId: string | null;
  workloadType: string;
}

function base(type: HealthEventType, trigger: HealthTrigger, health: ProviderHealthSnapshot): HealthEventBase {
  return {
    type,
    executionId: trigger.executionId,
    requestId: trigger.requestId,
    tenantId: trigger.tenantId,
    provider: health.provider,
    model: health.model,
    workloadType: trigger.workloadType,
    timestamp: observedNowMs(),
    health,
  };
}

export function providerHealthUpdated(trigger: HealthTrigger, health: ProviderHealthSnapshot): ProviderHealthUpdatedEvent {
  return deepFreeze({ ...base("provider_health.updated", trigger, health), type: "provider_health.updated" as const });
}
export function providerDegraded(trigger: HealthTrigger, health: ProviderHealthSnapshot): ProviderDegradedEvent {
  return deepFreeze({ ...base("provider_health.degraded", trigger, health), type: "provider_health.degraded" as const });
}
export function providerRecovered(trigger: HealthTrigger, health: ProviderHealthSnapshot): ProviderRecoveredEvent {
  return deepFreeze({ ...base("provider_health.recovered", trigger, health), type: "provider_health.recovered" as const });
}
export function providerUnavailable(trigger: HealthTrigger, health: ProviderHealthSnapshot): ProviderUnavailableEvent {
  return deepFreeze({ ...base("provider_health.unavailable", trigger, health), type: "provider_health.unavailable" as const });
}
