// IOS-012 — Fallback Orchestrator — coordinator.
//
// Drives the deterministic ordered fallback attempt loop AFTER the primary path
// has failed with a fallback-eligible error. Each attempt redirects the
// invocation to an alternate AUTHORIZED target via the ADR-0004 invocation-target
// override (`next(request, target)`), which routes through the inner middleware
// (retry) to that target. The first success returns; if all targets fail the
// loop is exhausted and the last error is rethrown. Emits fallback events; never
// re-runs routing or mutates the RoutingDecision.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import type { ExecutionTarget } from "@/lib/aiops/routing/routing-types";
import { normalizeError } from "@/lib/aiops/execution/execution-errors";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import {
  fallbackStarted,
  fallbackAttempt,
  fallbackSucceeded,
  fallbackExhausted,
} from "./fallback-events";

export interface FallbackCoordinatorDeps {
  /** Injectable clock (epoch ms) for deterministic latency metrics. */
  now?: () => number;
}

export class FallbackCoordinator {
  private readonly now: () => number;

  constructor(
    private readonly bus: ExecutionEventBus,
    deps: FallbackCoordinatorDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
  }

  /**
   * Run the ordered fallback chain. `primaryError` is the (already classified as
   * eligible) failure from the primary path; `targets` are the authorized
   * alternates in policy order; `next` is the downstream invocation chain.
   */
  async run(
    request: CompletionRequest,
    ctx: InferenceExecutionContext,
    primaryError: unknown,
    targets: ExecutionTarget[],
    next: (request: CompletionRequest, target?: ExecutionTarget) => Promise<CompletionResponse>,
  ): Promise<CompletionResponse> {
    const start = this.now();
    guard(() => this.bus.publish(fallbackStarted(ctx, normalizeError(primaryError).kind)));

    let lastError = primaryError;
    let attempt = 0;
    for (const target of targets) {
      attempt += 1;
      guard(() => this.bus.publish(fallbackAttempt(ctx, target, attempt)));
      try {
        const response = await next(request, target);
        guard(() => this.bus.publish(fallbackSucceeded(ctx, target, attempt, this.now() - start)));
        return response;
      } catch (err) {
        lastError = err;
      }
    }
    guard(() => this.bus.publish(fallbackExhausted(ctx, attempt, this.now() - start)));
    throw lastError;
  }
}
