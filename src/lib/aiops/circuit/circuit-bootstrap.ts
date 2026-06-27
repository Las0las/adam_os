// IOS-011 — Circuit Breaker — wiring.
//
// Builds the process-wide Circuit Breaker middleware and attaches it to the
// execution chain (priority 2.4: after the security middleware, OUTSIDE retry
// (2.5), wrapping the provider via the ADR-0003 aroundInvoke hook), with its
// metrics collector subscribed to the bus. Idempotent. The default policy is
// DISABLED, so installing it changes nothing until a tenant enables breaking.

import { registerExecutionHook } from "@/lib/aiops/execution/execution-hooks";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { CircuitBreaker } from "./circuit-breaker";
import { CircuitMetricsCollector } from "./circuit-metrics";
import { CircuitPolicyStore, type CircuitPolicy } from "./circuit-types";

export interface CircuitStack {
  policyStore: CircuitPolicyStore;
  breaker: CircuitBreaker;
  metrics: CircuitMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceCircuit?: CircuitStack };

export function circuitPlatform(): CircuitStack {
  if (!globalRef.__lawrenceCircuit) {
    const policyStore = new CircuitPolicyStore();
    globalRef.__lawrenceCircuit = {
      policyStore,
      breaker: new CircuitBreaker(observability().bus, policyStore),
      metrics: new CircuitMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceCircuit;
}

/**
 * Register the Circuit Breaker middleware into the execution chain and subscribe
 * its metrics collector to the bus. Idempotent. Optionally applies an initial
 * policy.
 */
export function installCircuitBreaker(policy?: CircuitPolicy): CircuitStack {
  const stack = circuitPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    registerExecutionHook(stack.breaker);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
