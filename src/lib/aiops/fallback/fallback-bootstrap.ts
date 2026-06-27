// IOS-012 — Fallback Orchestrator — wiring.
//
// Builds the process-wide Fallback Orchestrator and attaches it to the execution
// chain (priority 2.45: after the circuit breaker, outside retry, via the
// ADR-0003 aroundInvoke hook + ADR-0004 invocation-target override), with its
// metrics collector subscribed to the bus. Idempotent. The default policy is
// DISABLED, so installing it changes nothing until a tenant enables fallback.

import { registerExecutionHook } from "@/lib/aiops/execution/execution-hooks";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { FallbackOrchestrator } from "./fallback-orchestrator";
import { FallbackMetricsCollector } from "./fallback-metrics";
import { FallbackPolicyStore, type FallbackPolicy } from "./fallback-types";

export interface FallbackStack {
  policyStore: FallbackPolicyStore;
  orchestrator: FallbackOrchestrator;
  metrics: FallbackMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceFallback?: FallbackStack };

export function fallbackPlatform(): FallbackStack {
  if (!globalRef.__lawrenceFallback) {
    const policyStore = new FallbackPolicyStore();
    globalRef.__lawrenceFallback = {
      policyStore,
      orchestrator: new FallbackOrchestrator(observability().bus, policyStore),
      metrics: new FallbackMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceFallback;
}

/**
 * Register the Fallback Orchestrator into the execution chain and subscribe its
 * metrics collector to the bus. Idempotent. Optionally applies an initial policy.
 */
export function installFallbackOrchestrator(policy?: FallbackPolicy): FallbackStack {
  const stack = fallbackPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    registerExecutionHook(stack.orchestrator);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
