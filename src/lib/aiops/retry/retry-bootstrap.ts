// IOS-010 — Retry Policy — wiring.
//
// Builds the process-wide Retry middleware and attaches it to the execution chain
// (priority 2.5: after the security middleware, wrapping the provider via the
// ADR-0003 aroundInvoke hook), with its metrics collector subscribed to the bus.
// Idempotent. The default policy is DISABLED, so installing it changes nothing
// until a tenant enables retry.

import { registerExecutionHook } from "@/lib/aiops/execution/execution-hooks";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { RetryMiddleware } from "./retry-middleware";
import { RetryMetricsCollector } from "./retry-metrics";
import { RetryPolicyStore, type RetryPolicy } from "./retry-types";

export interface RetryStack {
  policyStore: RetryPolicyStore;
  middleware: RetryMiddleware;
  metrics: RetryMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceRetry?: RetryStack };

export function retryPlatform(): RetryStack {
  if (!globalRef.__lawrenceRetry) {
    const policyStore = new RetryPolicyStore();
    globalRef.__lawrenceRetry = {
      policyStore,
      middleware: new RetryMiddleware(observability().bus, policyStore),
      metrics: new RetryMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceRetry;
}

/**
 * Register the Retry middleware into the execution chain and subscribe its
 * metrics collector to the bus. Idempotent. Optionally applies an initial policy.
 */
export function installRetryMiddleware(policy?: RetryPolicy): RetryStack {
  const stack = retryPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    registerExecutionHook(stack.middleware);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
