// IOS-010 — Retry Policy — execution middleware.
//
// Attaches through the IOS-004 `aroundInvoke` provider-invocation hook (ADR-0003),
// positioned after the security middleware and wrapping the provider call. It
// retries transient provider failures per an immutable RetryPolicy, and is a
// no-op when the policy is disabled. It never changes provider selection, re-runs
// routing, or bypasses security/validation/telemetry/audit (those run as pipeline
// interceptors around the provider call).

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext, ExecutionHook } from "@/lib/aiops/execution/execution-types";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { RetryCoordinator } from "./retry-coordinator";
import { RETRY_PRIORITY, type RetryPolicyStore } from "./retry-types";

export interface RetryMiddlewareDeps {
  /** Awaitable delay; injectable for deterministic tests (default: setTimeout). */
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) { resolve(); return; }
    setTimeout(resolve, ms);
  });
}

export class RetryMiddleware implements ExecutionHook {
  readonly name = "retry";
  readonly priority = RETRY_PRIORITY;

  private readonly coordinator: RetryCoordinator;

  constructor(bus: ExecutionEventBus, store: RetryPolicyStore, deps: RetryMiddlewareDeps = {}) {
    this.coordinator = new RetryCoordinator({
      bus,
      policy: () => store.current(),
      sleep: deps.sleep ?? defaultSleep,
    });
  }

  aroundInvoke(
    request: CompletionRequest,
    ctx: InferenceExecutionContext,
    next: (request: CompletionRequest) => Promise<CompletionResponse>,
  ): Promise<CompletionResponse> {
    return this.coordinator.run(request, ctx, next);
  }
}
