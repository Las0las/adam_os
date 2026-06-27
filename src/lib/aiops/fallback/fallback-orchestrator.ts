// IOS-012 — Fallback Orchestrator — execution middleware.
//
// Attaches through the AS-001 R9 / IOS-004 AroundInvoke contract (ADR-0003) and
// its ADR-0004 invocation-target override at priority 2.45 — between the circuit
// breaker (2.4) and retry (2.5): security → circuit breaker → fallback → retry →
// provider. It first invokes the primary path (`next(request)`, which runs the
// inner retry against the routing-selected provider). On a fallback-eligible
// failure it redirects to alternate AUTHORIZED targets in deterministic policy
// order via `next(request, target)`. It never re-runs routing, mutates the
// RoutingDecision, selects an un-routed target, or bypasses security/validation
// (those interceptors run around the whole invocation). Default policy DISABLED.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext, ExecutionHook } from "@/lib/aiops/execution/execution-types";
import type { ExecutionTarget } from "@/lib/aiops/routing/routing-types";
import { normalizeError } from "@/lib/aiops/execution/execution-errors";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { fallbackBypassed } from "./fallback-events";
import { isFallbackEligible } from "./fallback-classifier";
import { orderedFallbackTargets } from "./fallback-strategy";
import { FallbackCoordinator, type FallbackCoordinatorDeps } from "./fallback-coordinator";
import { FALLBACK_PRIORITY, fallbackEligible, type FallbackPolicyStore } from "./fallback-types";

export class FallbackOrchestrator implements ExecutionHook {
  readonly name = "fallback-orchestrator";
  readonly priority = FALLBACK_PRIORITY;

  private readonly coordinator: FallbackCoordinator;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: FallbackPolicyStore,
    deps: FallbackCoordinatorDeps = {},
  ) {
    this.coordinator = new FallbackCoordinator(bus, deps);
  }

  async aroundInvoke(
    request: CompletionRequest,
    ctx: InferenceExecutionContext,
    next: (request: CompletionRequest, target?: ExecutionTarget) => Promise<CompletionResponse>,
  ): Promise<CompletionResponse> {
    const policy = this.store.current();
    // Fallback requires a routing plan to know which alternate targets exist;
    // without one (already-resolved provider path) it cannot run.
    if (policy.mode !== "enabled" || ctx.routingDecision === null || !fallbackEligible(policy, ctx)) {
      return next(request);
    }
    if (policy.bypass) {
      guard(() => this.bus.publish(fallbackBypassed(ctx)));
      return next(request);
    }

    try {
      return await next(request);
    } catch (err) {
      if (!isFallbackEligible(normalizeError(err).kind, policy)) throw err;
      // Targets are SELECTED FROM the immutable, routing-authorized Execution
      // Plan (ctx.executionPlan) — never invented or authorized here. The pipeline
      // independently enforces plan membership when invoking each target.
      const targets = orderedFallbackTargets(ctx.executionPlan, policy, ctx);
      if (targets.length === 0) throw err;
      return this.coordinator.run(request, ctx, err, targets, next);
    }
  }
}
