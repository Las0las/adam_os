// IOS-013 — Provider Health Manager — the observational subsystem.
//
// A subscriber on the Execution Event Bus (IOS-005). It folds observed execution
// outcomes (execution.completed/failed), retry outcomes (retry.succeeded/exhausted),
// circuit transitions (circuit.*), and fallback activations (fallback.started) into
// immutable ProviderHealthSnapshot records, evaluates a normalized status, stores
// the snapshot, and publishes health events back onto the bus.
//
// Strictly observational. It does NOT implement ExecutionHook, touch the pipeline,
// perform routing, authorize targets, modify the Execution Plan, invoke providers,
// retry, or trigger fallback. It ignores its own provider_health.* events (no
// recursion) and never throws into the bus (delivery is guarded).

import { isExecutionEvent } from "@/lib/aiops/execution/observability/execution-events";
import { isRetryEvent } from "@/lib/aiops/retry/retry-events";
import { isCircuitEvent } from "@/lib/aiops/circuit/circuit-events";
import { isFallbackEvent } from "@/lib/aiops/fallback/fallback-events";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { BusEvent, ExecutionEventBus, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { evaluateHealth, computeHealthScore } from "./health-evaluator";
import {
  isHealthEvent,
  providerHealthUpdated,
  providerDegraded,
  providerRecovered,
  providerUnavailable,
  type HealthTrigger,
} from "./health-events";
import {
  healthEligible,
  healthKey,
  type HealthPolicy,
  type HealthPolicyStore,
  type HealthStatus,
  type ObservedCircuitState,
  type ProviderHealthSnapshot,
} from "./health-types";

interface Sample {
  success: boolean;
  timeout: boolean;
  latencyMs: number;
}

/** Mutable per-key accumulator (the published snapshot is a frozen projection). */
interface HealthAccumulator {
  samples: Sample[]; // bounded to the observation window
  totalExecutions: number;
  retrySucceeded: number;
  retryExhausted: number;
  fallbackStarts: number;
  circuitState: ObservedCircuitState;
}

export interface ProviderHealthManagerDeps {
  /** Injectable clock (epoch ms) for deterministic lastUpdated timestamps. */
  now?: () => number;
}

export class ProviderHealthManager implements ExecutionEventSubscriber {
  readonly name = "provider-health-manager";

  private readonly accumulators = new Map<string, HealthAccumulator>();
  private readonly now: () => number;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: { set(s: ProviderHealthSnapshot): void; get(p: string, m: string): ProviderHealthSnapshot | null },
    private readonly policyStore: HealthPolicyStore,
    deps: ProviderHealthManagerDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
  }

  onEvent(event: BusEvent): void {
    if (isHealthEvent(event)) return; // never react to our own events
    const policy = this.policyStore.current();
    if (policy.mode !== "enabled") return;
    if (!event.provider || !event.model) return;
    if (!healthEligible(policy, event.provider, event.workloadType)) return;

    const acc = this.accumulator(event.provider, event.model);
    let changed = false;

    if (isExecutionEvent(event)) {
      if (event.type === "execution.completed") {
        this.addSample(acc, policy.observationWindow, { success: true, timeout: false, latencyMs: event.latency });
        changed = true;
      } else if (event.type === "execution.failed") {
        const timeout = event.error.kind === "timeout";
        this.addSample(acc, policy.observationWindow, { success: false, timeout, latencyMs: event.latency });
        changed = true;
      }
    } else if (isRetryEvent(event)) {
      if (event.type === "retry.succeeded") { acc.retrySucceeded += 1; changed = true; }
      else if (event.type === "retry.exhausted") { acc.retryExhausted += 1; changed = true; }
    } else if (isCircuitEvent(event)) {
      if (event.type === "circuit.opened" || event.type === "circuit.rejected") { acc.circuitState = "open"; changed = true; }
      else if (event.type === "circuit.half_opened") { acc.circuitState = "half_open"; changed = true; }
      else if (event.type === "circuit.closed") { acc.circuitState = "closed"; changed = true; }
    } else if (isFallbackEvent(event)) {
      if (event.type === "fallback.started") { acc.fallbackStarts += 1; changed = true; }
    }

    if (!changed) return;

    const prior = this.store.get(event.provider, event.model)?.status ?? "unknown";
    const snapshot = this.buildSnapshot(event.provider, event.model, acc, prior, policy);
    this.store.set(snapshot);

    const trigger: HealthTrigger = {
      executionId: event.executionId,
      requestId: event.requestId,
      tenantId: event.tenantId,
      workloadType: event.workloadType,
    };
    guard(() => this.bus.publish(providerHealthUpdated(trigger, snapshot)));
    if (snapshot.status !== prior) this.publishTransition(trigger, snapshot);
  }

  private publishTransition(trigger: HealthTrigger, snapshot: ProviderHealthSnapshot): void {
    if (snapshot.status === "degraded") guard(() => this.bus.publish(providerDegraded(trigger, snapshot)));
    else if (snapshot.status === "unavailable") guard(() => this.bus.publish(providerUnavailable(trigger, snapshot)));
    else if (snapshot.status === "healthy") guard(() => this.bus.publish(providerRecovered(trigger, snapshot)));
  }

  private accumulator(provider: string, model: string): HealthAccumulator {
    const key = healthKey(provider, model);
    let acc = this.accumulators.get(key);
    if (!acc) {
      acc = { samples: [], totalExecutions: 0, retrySucceeded: 0, retryExhausted: 0, fallbackStarts: 0, circuitState: "unknown" };
      this.accumulators.set(key, acc);
    }
    return acc;
  }

  private addSample(acc: HealthAccumulator, window: number, sample: Sample): void {
    acc.totalExecutions += 1;
    acc.samples.push(sample);
    const cap = Math.max(1, window);
    while (acc.samples.length > cap) acc.samples.shift();
  }

  private buildSnapshot(
    provider: string,
    model: string,
    acc: HealthAccumulator,
    prior: HealthStatus,
    policy: HealthPolicy,
  ): ProviderHealthSnapshot {
    const total = acc.samples.length;
    const successes = acc.samples.filter((s) => s.success).length;
    const timeouts = acc.samples.filter((s) => s.timeout).length;
    const availability = total === 0 ? 1 : successes / total;
    const errorRate = total === 0 ? 0 : (total - successes) / total;
    const timeoutRate = total === 0 ? 0 : timeouts / total;
    const latencyMs = total === 0 ? 0 : acc.samples.reduce((sum, s) => sum + s.latencyMs, 0) / total;
    const retryTotal = acc.retrySucceeded + acc.retryExhausted;
    const retrySuccessRate = retryTotal === 0 ? 1 : acc.retrySucceeded / retryTotal;
    const fallbackFrequency = acc.totalExecutions === 0 ? 0 : acc.fallbackStarts / acc.totalExecutions;

    const status = evaluateHealth(prior, { total, availability, circuitState: acc.circuitState }, policy);
    const healthScore = total === 0 ? 1 : computeHealthScore(availability, acc.circuitState);

    return deepFreeze({
      provider,
      model,
      status,
      availability,
      latencyMs,
      timeoutRate,
      errorRate,
      retrySuccessRate,
      circuitState: acc.circuitState,
      fallbackFrequency,
      healthScore,
      lastUpdated: this.now(),
    });
  }

  /** Test/statistics helper: reset all accumulators. */
  reset(): void {
    this.accumulators.clear();
  }
}
