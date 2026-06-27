// IOS-019 — Cost Optimization Engine — wiring.
//
// Exposes the process-wide Cost Optimization Engine + Recommendation store. It is
// advisory and on-demand: installing it registers NO execution hook and changes no
// execution behavior. The default policy is DISABLED (no-op until enabled).

import { CostOptimizationEngine } from "./cost-engine";
import { RecommendationStore } from "./recommendation-store";
import { CostOptimizationPolicyStore, type CostOptimizationPolicy } from "./recommendation-types";

export interface CostOptimizationStack {
  policyStore: CostOptimizationPolicyStore;
  store: RecommendationStore;
  engine: CostOptimizationEngine;
}

const globalRef = globalThis as unknown as { __lawrenceCostOptimization?: CostOptimizationStack };

export function costOptimizationPlatform(): CostOptimizationStack {
  if (!globalRef.__lawrenceCostOptimization) {
    const policyStore = new CostOptimizationPolicyStore();
    const store = new RecommendationStore();
    globalRef.__lawrenceCostOptimization = {
      policyStore,
      store,
      engine: new CostOptimizationEngine(store, policyStore),
    };
  }
  return globalRef.__lawrenceCostOptimization;
}

export function installCostOptimizationEngine(policy?: CostOptimizationPolicy): CostOptimizationStack {
  const stack = costOptimizationPlatform();
  if (policy) stack.policyStore.configure(policy);
  return stack;
}

/** The read-only recommendation store (for advisory consumers). */
export function recommendationStore(): RecommendationStore {
  return costOptimizationPlatform().store;
}
