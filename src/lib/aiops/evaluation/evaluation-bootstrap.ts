// IOS-017 — Evaluation Engine — wiring.
//
// Builds the process-wide evaluation platform around a DEDICATED evaluation event
// bus (an Isolated Execution Environment, IOS-016 model) — NOT the production bus.
// Evaluation-scoped metrics subscribe to the evaluation bus only, so evaluation
// never contaminates production health (IOS-013) or production metrics. The engine
// is invoked on demand; the default policy is DISABLED (no-op).

import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { EvaluationEngine } from "./evaluation-engine";
import { EvaluationStore } from "./evaluation-store";
import { EvaluationMetricsCollector } from "./evaluation-metrics";
import { EvaluationPolicyStore, type EvaluationPolicy } from "./evaluation-types";

export interface EvaluationStack {
  bus: ExecutionEventBus;
  policyStore: EvaluationPolicyStore;
  store: EvaluationStore;
  engine: EvaluationEngine;
  metrics: EvaluationMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceEvaluation?: EvaluationStack };

export function evaluationPlatform(): EvaluationStack {
  if (!globalRef.__lawrenceEvaluation) {
    const bus = new ExecutionEventBus();
    const policyStore = new EvaluationPolicyStore();
    const store = new EvaluationStore();
    globalRef.__lawrenceEvaluation = {
      bus,
      policyStore,
      store,
      engine: new EvaluationEngine(bus, store, policyStore),
      metrics: new EvaluationMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceEvaluation;
}

export function installEvaluationEngine(policy?: EvaluationPolicy): EvaluationStack {
  const stack = evaluationPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    stack.bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}

/** The read-only canonical EvaluationResult/Report store (for consumers). */
export function evaluationStore(): EvaluationStore {
  return evaluationPlatform().store;
}
