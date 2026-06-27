// IOS-009 — Semantic Cache — wiring.
//
// Registers the SemanticCacheStore on the EXISTING Cache Platform registry
// (`cachePlatform().registry`) and subscribes its metrics collector to the shared
// bus. This is the entire integration: the CacheManager, Execution Pipeline, and
// PromptCache middleware are unmodified — the resolver consults the semantic store
// because it is registered. Registered after the ExactMatchCacheStore, so exact
// matches are tried first and the semantic store catches near-matches. Idempotent.
// Semantic caching only does anything when the CachePolicy is enabled (default
// disabled) and the SimilarityPolicy is enabled (default enabled).

import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { cachePlatform } from "./cache-bootstrap";
import { SemanticCacheStore } from "./semantic-cache-store";
import { SemanticCacheMetricsCollector } from "./semantic-metrics";
import { SimilarityPolicyStore, type SimilarityPolicy } from "./semantic-types";

export interface SemanticStack {
  policyStore: SimilarityPolicyStore;
  store: SemanticCacheStore;
  metrics: SemanticCacheMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceSemanticCache?: SemanticStack };

export function semanticCache(): SemanticStack {
  if (!globalRef.__lawrenceSemanticCache) {
    const policyStore = new SimilarityPolicyStore();
    globalRef.__lawrenceSemanticCache = {
      policyStore,
      store: new SemanticCacheStore(observability().bus, policyStore),
      metrics: new SemanticCacheMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceSemanticCache;
}

/**
 * Register the Semantic Cache store on the Cache Platform registry and subscribe
 * its metrics collector to the bus. Idempotent. Optionally applies an initial
 * similarity policy.
 */
export function installSemanticCache(policy?: SimilarityPolicy): SemanticStack {
  const stack = semanticCache();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    cachePlatform().registry.register(stack.store);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
