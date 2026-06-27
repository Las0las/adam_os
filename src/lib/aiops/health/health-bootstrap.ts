// IOS-013 — Provider Health Manager — wiring.
//
// Subscribes the Provider Health Manager and its metrics collector to the
// Execution Event Bus. Purely observational — it registers NO execution hook and
// changes no execution behavior. Idempotent. The default policy is DISABLED, so
// installing it is a no-op until a tenant enables health tracking. Exposes the
// ProviderHealth store as the canonical, read-only health source for consumers.

import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { ProviderHealthManager } from "./health-manager";
import { ProviderHealthStore } from "./health-store";
import { HealthMetricsCollector } from "./health-metrics";
import { HealthPolicyStore, type HealthPolicy } from "./health-types";

export interface HealthStack {
  policyStore: HealthPolicyStore;
  store: ProviderHealthStore;
  manager: ProviderHealthManager;
  metrics: HealthMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceHealth?: HealthStack };

export function healthPlatform(): HealthStack {
  if (!globalRef.__lawrenceHealth) {
    const policyStore = new HealthPolicyStore();
    const store = new ProviderHealthStore();
    globalRef.__lawrenceHealth = {
      policyStore,
      store,
      manager: new ProviderHealthManager(observability().bus, store, policyStore),
      metrics: new HealthMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceHealth;
}

/**
 * Subscribe the Provider Health Manager + metrics to the bus. Idempotent.
 * Optionally applies an initial policy.
 */
export function installProviderHealthManager(policy?: HealthPolicy): HealthStack {
  const stack = healthPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    observability().bus.subscribe(stack.manager);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}

/** The canonical, read-only ProviderHealth store (for consumers). */
export function providerHealthStore(): ProviderHealthStore {
  return healthPlatform().store;
}
