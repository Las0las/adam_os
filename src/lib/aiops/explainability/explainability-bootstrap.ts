// IOS-015 — Explainability Engine — wiring.
//
// Subscribes the Explainability Engine and its metrics collector to the Execution
// Event Bus. Purely observational — it registers NO execution hook and changes no
// execution behavior. Idempotent. The default policy is DISABLED, so installing it
// is a no-op until a tenant enables it. Exposes the Explanation store as the
// read-only source of execution explanations.

import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { ExplainabilityEngine } from "./explainability-engine";
import { ExplanationStore } from "./explanation-store";
import { ExplainabilityMetricsCollector } from "./explainability-metrics";
import { ExplainabilityPolicyStore, type ExplainabilityPolicy } from "./explainability-types";

export interface ExplainabilityStack {
  policyStore: ExplainabilityPolicyStore;
  store: ExplanationStore;
  engine: ExplainabilityEngine;
  metrics: ExplainabilityMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceExplainability?: ExplainabilityStack };

export function explainabilityPlatform(): ExplainabilityStack {
  if (!globalRef.__lawrenceExplainability) {
    const policyStore = new ExplainabilityPolicyStore();
    const store = new ExplanationStore();
    globalRef.__lawrenceExplainability = {
      policyStore,
      store,
      engine: new ExplainabilityEngine(observability().bus, store, policyStore),
      metrics: new ExplainabilityMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceExplainability;
}

export function installExplainabilityEngine(policy?: ExplainabilityPolicy): ExplainabilityStack {
  const stack = explainabilityPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    observability().bus.subscribe(stack.engine);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}

/** The read-only Explanation store (for consumers/surfaces). */
export function explanationStore(): ExplanationStore {
  return explainabilityPlatform().store;
}
