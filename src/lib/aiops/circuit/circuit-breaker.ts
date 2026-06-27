// IOS-011 — Circuit Breaker — execution middleware.
//
// Attaches through the AS-001 R9 / IOS-004 AroundInvoke contract (ADR-0003) at
// priority 2.4 — outside retry (2.5), so an open circuit fast-fails immediately
// without consuming retry attempts: security → breaker → retry → provider. It
// tracks a state machine per circuit (provider+model):
//
//   closed --(failureThreshold qualifying failures)--> open
//   open   --(cooldown elapsed)--> half_open
//   half_open --(successThreshold successes)--> closed
//   half_open --(qualifying failure)--> open
//
// While open it rejects calls without invoking the provider (a normalized
// ProviderUnavailableError — no new error kind is introduced). It never re-runs
// routing, changes provider selection, or bypasses security/validation (those run
// as pipeline interceptors around the invocation). Default policy DISABLED (no-op).

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext, ExecutionHook } from "@/lib/aiops/execution/execution-types";
import { normalizeError, ProviderUnavailableError } from "@/lib/aiops/execution/execution-errors";
import { fingerprint } from "@/lib/aiops/execution/observability/fingerprint";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import {
  circuitOpened,
  circuitClosed,
  circuitHalfOpened,
  circuitRejected,
} from "./circuit-events";
import { tripsCircuit } from "./circuit-classifier";
import {
  CIRCUIT_PRIORITY,
  circuitEligible,
  circuitKey,
  type CircuitPolicy,
  type CircuitPolicyStore,
  type CircuitState,
} from "./circuit-types";

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  halfOpenSuccesses: number;
  openedAt: number;
}

export interface CircuitBreakerDeps {
  /** Injectable clock (epoch ms) for deterministic cooldown tests. */
  now?: () => number;
}

export class CircuitBreaker implements ExecutionHook {
  readonly name = "circuit-breaker";
  readonly priority = CIRCUIT_PRIORITY;

  private readonly circuits = new Map<string, CircuitRecord>();
  private readonly now: () => number;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: CircuitPolicyStore,
    deps: CircuitBreakerDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
  }

  private record(key: string): CircuitRecord {
    let r = this.circuits.get(key);
    if (!r) {
      r = { state: "closed", failures: 0, halfOpenSuccesses: 0, openedAt: 0 };
      this.circuits.set(key, r);
    }
    return r;
  }

  /** Current state of a circuit (for tests / statistics). */
  state(key: string): CircuitState {
    return this.circuits.get(key)?.state ?? "closed";
  }

  reset(): void {
    this.circuits.clear();
  }

  async aroundInvoke(
    request: CompletionRequest,
    ctx: InferenceExecutionContext,
    next: (request: CompletionRequest) => Promise<CompletionResponse>,
  ): Promise<CompletionResponse> {
    const policy = this.store.current();
    if (policy.mode !== "enabled" || policy.bypass || !circuitEligible(policy, ctx)) {
      return next(request);
    }

    const key = circuitKey(ctx);
    const digest = fingerprint(key);
    const r = this.record(key);

    if (r.state === "open") {
      if (this.now() - r.openedAt >= policy.cooldownMs) {
        r.state = "half_open";
        r.halfOpenSuccesses = 0;
        guard(() => this.bus.publish(circuitHalfOpened(ctx, digest)));
      } else {
        guard(() => this.bus.publish(circuitRejected(ctx, digest)));
        throw new ProviderUnavailableError(`circuit open for ${key}`);
      }
    }

    try {
      const response = await next(request);
      this.onSuccess(r, ctx, digest, policy);
      return response;
    } catch (err) {
      this.onFailure(r, ctx, digest, policy, normalizeError(err).kind);
      throw err;
    }
  }

  private onSuccess(r: CircuitRecord, ctx: InferenceExecutionContext, digest: string, policy: CircuitPolicy): void {
    if (r.state === "half_open") {
      r.halfOpenSuccesses += 1;
      if (r.halfOpenSuccesses >= Math.max(1, policy.successThreshold)) {
        r.state = "closed";
        r.failures = 0;
        r.halfOpenSuccesses = 0;
        guard(() => this.bus.publish(circuitClosed(ctx, digest)));
      }
      return;
    }
    // closed: a success resets the consecutive-failure streak.
    r.failures = 0;
  }

  private onFailure(r: CircuitRecord, ctx: InferenceExecutionContext, digest: string, policy: CircuitPolicy, kind: Parameters<typeof tripsCircuit>[0]): void {
    if (!tripsCircuit(kind, policy)) return; // non-qualifying failures don't move the breaker
    if (r.state === "half_open") {
      r.state = "open";
      r.openedAt = this.now();
      r.failures = Math.max(r.failures, policy.failureThreshold);
      guard(() => this.bus.publish(circuitOpened(ctx, digest, r.failures)));
      return;
    }
    r.failures += 1;
    if (r.failures >= Math.max(1, policy.failureThreshold)) {
      r.state = "open";
      r.openedAt = this.now();
      guard(() => this.bus.publish(circuitOpened(ctx, digest, r.failures)));
    }
  }
}
