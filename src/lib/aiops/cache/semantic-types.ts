// IOS-009 — Semantic Cache — similarity policy + contracts.
//
// The semantic store carries its OWN policy (similarity threshold / enablement)
// separate from the IOS-007 CachePolicy, so the Cache Platform is not modified.
// TTL and capacity are taken from the CachePolicy passed to the store on each
// operation (IOS-007 contract); the similarity threshold is semantic-specific.
// Policies are immutable during execution.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";

/** Stable store name used for registration, selection, events, and metrics. */
export const SEMANTIC_STORE_NAME = "semantic";

export interface SimilarityPolicy {
  /** When false, the semantic store neither serves nor stores (exact + provider
   *  paths are unaffected). */
  enabled: boolean;
  /** Confidence threshold in [0, 1]; a candidate is a hit only when its cosine
   *  similarity is >= threshold. */
  threshold: number;
}

/** Conservative default: enabled, with a high confidence threshold so only very
 *  close prompts match (avoids false reuse). */
export function defaultSimilarityPolicy(): SimilarityPolicy {
  return { enabled: true, threshold: 0.9 };
}

/** Holds the active similarity policy as an immutable snapshot. */
export class SimilarityPolicyStore {
  private policy: SimilarityPolicy;

  constructor(policy: SimilarityPolicy = defaultSimilarityPolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): SimilarityPolicy {
    return this.policy;
  }

  configure(policy: SimilarityPolicy): void {
    this.policy = deepFreeze(policy);
  }
}
