// IOS-010 — Retry Policy — Retry Coordinator.
//
// Manages the retry lifecycle around a single provider invocation: it calls
// `next` (the downstream provider call), and on a transient, retryable failure
// re-invokes after a deterministic backoff, up to the policy's attempt bound. It
// preserves the execution context and request identity (the same `request`/`ctx`
// are reused — routing is never re-run, provider selection never changes), and it
// terminates deterministically. Security and validation run OUTSIDE this scope
// (they are pipeline interceptors), so retry can never bypass them.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import {
  normalizeError,
  ExecutionFailedError,
  type ExecutionError,
} from "@/lib/aiops/execution/execution-errors";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import {
  retryStarted,
  retryAttempt,
  retrySucceeded,
  retryExhausted,
  retryBypassed,
} from "./retry-events";
import { computeDelayMs } from "./retry-strategy";
import { isRetryableUnder } from "./retry-classifier";
import { retryEligible, type RetryPolicy } from "./retry-types";

export interface RetryCoordinatorDeps {
  bus: ExecutionEventBus;
  policy(): RetryPolicy;
  /** Awaitable delay; injectable for deterministic tests. */
  sleep(ms: number): Promise<void>;
}

export class RetryCoordinator {
  constructor(private readonly deps: RetryCoordinatorDeps) {}

  async run(
    request: CompletionRequest,
    ctx: InferenceExecutionContext,
    next: (request: CompletionRequest) => Promise<CompletionResponse>,
  ): Promise<CompletionResponse> {
    const policy = this.deps.policy();
    if (policy.mode !== "enabled") return next(request);
    if (policy.bypass) {
      guard(() => this.deps.bus.publish(retryBypassed(ctx, "bypass")));
      return next(request);
    }
    if (!retryEligible(policy, ctx)) {
      guard(() => this.deps.bus.publish(retryBypassed(ctx, "ineligible")));
      return next(request);
    }

    const maxAttempts = Math.max(1, policy.maxAttempts);
    guard(() => this.deps.bus.publish(retryStarted(ctx, maxAttempts)));

    let attempt = 0;
    let lastError: ExecutionError | undefined;
    while (true) {
      attempt += 1;
      try {
        const response = await next(request);
        if (attempt > 1) guard(() => this.deps.bus.publish(retrySucceeded(ctx, attempt)));
        return response;
      } catch (err) {
        const normalized = normalizeError(err);
        lastError = normalized;
        const retryable = isRetryableUnder(normalized.kind, policy);
        const willRetry = retryable && attempt < maxAttempts;
        const delayMs = willRetry ? computeDelayMs(attempt, policy) : 0;
        guard(() => this.deps.bus.publish(retryAttempt(ctx, attempt, normalized.kind, retryable, delayMs)));
        if (!willRetry) break;
        await this.deps.sleep(delayMs);
      }
    }

    const error = lastError ?? new ExecutionFailedError("retry failed");
    guard(() => this.deps.bus.publish(retryExhausted(ctx, attempt, error.kind)));
    throw error;
  }
}
