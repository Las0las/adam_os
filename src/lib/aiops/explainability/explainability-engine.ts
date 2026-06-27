// IOS-015 — Explainability Engine.
//
// A subscriber on the Execution Event Bus (IOS-005). It correlates the events of
// a single execution (by executionId) — security, cache, retry, circuit, fallback
// — and, on the terminal execution event, finalizes an immutable Explanation from
// the accumulated signals plus the RoutingDecision/ExecutionPlan carried on the
// event. It stores the Explanation and publishes explanation.produced.
//
// Strictly observational: it registers NO execution hook, performs no routing,
// invokes no providers, and mutates nothing it reads (RoutingDecision, Execution
// Plan, ProviderHealth). It ignores its own explanation.* events (no recursion)
// and never throws into the bus (guarded). Default policy DISABLED.

import { isExecutionEvent, type ExecutionCompletedEvent, type ExecutionFailedEvent } from "@/lib/aiops/execution/observability/execution-events";
import { isSecurityEvent } from "@/lib/aiops/security/security-events";
import { isCacheEvent } from "@/lib/aiops/cache/cache-events";
import { isRetryEvent } from "@/lib/aiops/retry/retry-events";
import { isCircuitEvent } from "@/lib/aiops/circuit/circuit-events";
import { isFallbackEvent } from "@/lib/aiops/fallback/fallback-events";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { ExecutionTarget } from "@/lib/aiops/routing/routing-types";
import type { BusEvent, ExecutionEventBus, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { explanationProduced, isExplanationEvent } from "./explainability-events";
import { ExplanationStore } from "./explanation-store";
import {
  explainabilityEligible,
  type Explanation,
  type ExplainabilityPolicyStore,
  type SecurityExplanation,
} from "./explainability-types";

/** Mutable per-execution correlation slot, finalized into an Explanation. */
interface Slot {
  security: SecurityExplanation;
  cacheLookedUp: boolean;
  cacheHit: boolean;
  retryAttempts: number;
  retryOutcome: "succeeded" | "exhausted" | null;
  circuitState: string;
  circuitRejected: boolean;
  fallbackOccurred: boolean;
  fallbackTarget: ExecutionTarget | null;
}

function newSlot(): Slot {
  return {
    security: { inspected: false, promptOutcome: null, piiDetected: false, piiMasked: false, validation: null },
    cacheLookedUp: false,
    cacheHit: false,
    retryAttempts: 0,
    retryOutcome: null,
    circuitState: "unknown",
    circuitRejected: false,
    fallbackOccurred: false,
    fallbackTarget: null,
  };
}

export class ExplainabilityEngine implements ExecutionEventSubscriber {
  readonly name = "explainability-engine";

  private readonly slots = new Map<string, Slot>();

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: ExplanationStore,
    private readonly policyStore: ExplainabilityPolicyStore,
  ) {}

  onEvent(event: BusEvent): void {
    if (isExplanationEvent(event)) return; // never react to our own events
    const policy = this.policyStore.current();
    if (policy.mode !== "enabled") return;
    if (!event.executionId) return;
    if (event.provider && !explainabilityEligible(policy, event.provider, event.workloadType)) return;

    if (isExecutionEvent(event)) {
      if (event.type === "execution.started") {
        this.slots.set(event.executionId, newSlot());
        return;
      }
      // Terminal events finalize the Explanation.
      this.store.setRetain(policy.retain);
      const slot = this.slots.get(event.executionId) ?? newSlot();
      const explanation = this.finalize(event, slot);
      this.store.set(explanation);
      this.slots.delete(event.executionId);
      guard(() => this.bus.publish(explanationProduced(explanation)));
      return;
    }

    const slot = this.slots.get(event.executionId);
    if (!slot) return; // only correlate within a known execution window

    if (isSecurityEvent(event)) {
      slot.security.inspected = true;
      if (event.type === "security.prompt_inspected") slot.security.promptOutcome = event.outcome;
      else if (event.type === "security.pii_detected") slot.security.piiDetected = true;
      else if (event.type === "security.pii_masked") slot.security.piiMasked = true;
      else if (event.type === "security.validation_succeeded") slot.security.validation = "succeeded";
      else if (event.type === "security.validation_failed") slot.security.validation = "failed";
    } else if (isCacheEvent(event)) {
      if (event.type === "cache.lookup_started") slot.cacheLookedUp = true;
      else if (event.type === "cache.hit") { slot.cacheLookedUp = true; slot.cacheHit = true; }
      else if (event.type === "cache.miss") slot.cacheLookedUp = true;
    } else if (isRetryEvent(event)) {
      if (event.type === "retry.attempt") slot.retryAttempts += 1;
      else if (event.type === "retry.succeeded") slot.retryOutcome = "succeeded";
      else if (event.type === "retry.exhausted") slot.retryOutcome = "exhausted";
    } else if (isCircuitEvent(event)) {
      if (event.type === "circuit.rejected") slot.circuitRejected = true;
      slot.circuitState =
        event.type === "circuit.opened" || event.type === "circuit.rejected" ? "open"
        : event.type === "circuit.half_opened" ? "half_open"
        : event.type === "circuit.closed" ? "closed" : slot.circuitState;
    } else if (isFallbackEvent(event)) {
      if (event.type === "fallback.started") slot.fallbackOccurred = true;
      else if (event.type === "fallback.succeeded") slot.fallbackTarget = { provider: event.targetProvider, model: event.targetModel };
    }
  }

  private finalize(event: ExecutionCompletedEvent | ExecutionFailedEvent, slot: Slot): Explanation {
    // The terminal execution event carries the immutable RoutingDecision.
    const decision = event.routingDecision;
    const success = event.type === "execution.completed";
    const errorKind = event.type === "execution.failed" ? event.error.kind : null;
    const latencyMs = event.latency;

    return deepFreeze({
      executionId: event.executionId,
      requestId: event.requestId,
      tenantId: event.tenantId,
      provider: event.provider,
      model: event.model,
      workloadType: event.workloadType,
      timestamp: event.timestamp,
      routing: {
        selectedProvider: decision?.selectedProvider ?? null,
        selectedModel: decision?.selectedModel ?? null,
        planTargets: decision?.executionPlan ? decision.executionPlan.targets.map((t) => ({ provider: t.provider, model: t.model })) : [],
        evaluatedProviders: decision ? [...decision.evaluatedProviders] : [],
        rejections: decision ? decision.rejectionReasons.map((r) => ({ provider: r.provider, model: r.model, reason: r.reason })) : [],
      },
      security: { ...slot.security },
      cache: { lookedUp: slot.cacheLookedUp, hit: slot.cacheHit },
      retry: { attempts: slot.retryAttempts, outcome: slot.retryOutcome },
      circuit: { state: slot.circuitState, rejected: slot.circuitRejected },
      fallback: { occurred: slot.fallbackOccurred, target: slot.fallbackTarget },
      healthRef: `${event.provider}|${event.model}`,
      outcome: { success, errorKind, latencyMs },
    });
  }

  /** Test/statistics helper: drop all in-progress correlation slots. */
  reset(): void {
    this.slots.clear();
  }
}
