// IOS-020 — SLA Management Engine.
//
// Purely advisory: consumes provider health (IOS-013) — and, by reference, model
// metadata (IOS-018), evaluation/benchmark/execution evidence and the abstract
// Recommendation contract — and produces immutable SLARecommendation objects (a
// concrete specialization of the shared Recommendation taxonomy). It NEVER
// influences routing, authorizes execution, invokes providers, or mutates any
// consumed object. Default policy DISABLED.

import { id } from "@/lib/lawrence-core/utils/ids";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import { RecommendationStore } from "@/lib/aiops/recommendation/recommendation-store";
import { analyzeSLA, type SLAAnalysisInput } from "./sla-analyzer";
import type { SLAPolicyStore, SLARecommendation } from "./sla-types";

export interface SLAEngineDeps {
  now?: () => number;
  newRecommendationId?: (subjectKey: string) => string;
}

export class SLAManagementEngine {
  private readonly now: () => number;
  private readonly newRecommendationId: (subjectKey: string) => string;

  constructor(
    /** Shared taxonomy store (reused class; SLA writes its own concrete objects). */
    private readonly store: RecommendationStore,
    private readonly policyStore: SLAPolicyStore,
    deps: SLAEngineDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
    this.newRecommendationId = deps.newRecommendationId ?? (() => id("slarec"));
  }

  /**
   * Produce SLARecommendations from the supplied health evidence. Advisory and
   * read-only — returns immutable recommendations and records them. A no-op
   * (empty) when the policy is disabled.
   */
  recommend(input: SLAAnalysisInput): SLARecommendation[] {
    const policy = this.policyStore.current();
    if (policy.mode !== "enabled") return [];

    const recommendations = analyzeSLA(input, policy, this.now, this.newRecommendationId).map((r) => deepFreeze(r));
    for (const r of recommendations) this.store.add(r);
    return recommendations;
  }
}
