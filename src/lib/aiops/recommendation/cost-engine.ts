// IOS-019 — Cost Optimization Engine.
//
// Purely advisory: consumes published metadata (IOS-018), execution history (cost
// observations), benchmark results (IOS-014), provider health (IOS-013), and
// evaluation results (IOS-017) BY REFERENCE, and produces immutable
// CostRecommendation objects (the first specialization of the canonical
// Recommendation family). It NEVER influences routing, authorizes execution
// targets, or mutates any consumed object. Default policy DISABLED.

import { id } from "@/lib/lawrence-core/utils/ids";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import { analyzeCost, type CostAnalysisInput } from "./cost-analyzer";
import type { RecommendationStore } from "./recommendation-store";
import type { CostOptimizationPolicyStore, CostRecommendation } from "./recommendation-types";

export interface CostEngineDeps {
  now?: () => number;
  newRecommendationId?: (subjectKey: string) => string;
}

export class CostOptimizationEngine {
  private readonly now: () => number;
  private readonly newRecommendationId: (subjectKey: string) => string;

  constructor(
    private readonly store: RecommendationStore,
    private readonly policyStore: CostOptimizationPolicyStore,
    deps: CostEngineDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
    this.newRecommendationId = deps.newRecommendationId ?? (() => id("costrec"));
  }

  /**
   * Produce CostRecommendations from the supplied evidence. Advisory and
   * read-only — returns immutable recommendations and records them in the store.
   * A no-op (empty) when the policy is disabled.
   */
  recommend(input: CostAnalysisInput): CostRecommendation[] {
    const policy = this.policyStore.current();
    if (policy.mode !== "enabled") return [];

    const recommendations = analyzeCost(input, policy, this.now, this.newRecommendationId).map((r) => deepFreeze(r));
    for (const r of recommendations) this.store.add(r);
    return recommendations;
  }
}
