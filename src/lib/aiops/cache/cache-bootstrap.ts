// Unified Cache Platform (Milestone 7.5) — wiring.
//
// Installs the PromptCache middleware as the cache entry point in the execution
// chain (priority 0). PromptCache is a thin compatibility layer that delegates to
// a CacheManager, which owns all cache behavior (policy evaluation, store
// selection via the CacheResolver over the CacheRegistry, lookup/store, event
// publication). The ExactMatchCacheStore is the only registered store; future
// stores register on `stack.registry` with no pipeline changes. Idempotent. The
// default policy is DISABLED, so installing it changes nothing until a tenant
// enables caching.

import { registerExecutionHook } from "@/lib/aiops/execution/execution-hooks";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { PromptCache } from "./prompt-cache";
import type { CacheManager } from "./cache-manager";
import type { CacheRegistry } from "./cache-registry";
import type { CacheResolver } from "./cache-resolver";
import { CacheMetricsCollector } from "./cache-metrics";
import { CachePolicyStore, type CachePolicy } from "./cache-types";

export interface CacheStack {
  policyStore: CachePolicyStore;
  /** The middleware entry point (delegates to the manager). */
  cache: PromptCache;
  manager: CacheManager;
  registry: CacheRegistry;
  resolver: CacheResolver;
  metrics: CacheMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceCache?: CacheStack };

export function cachePlatform(): CacheStack {
  if (!globalRef.__lawrenceCache) {
    const policyStore = new CachePolicyStore();
    const cache = new PromptCache(observability().bus, policyStore);
    globalRef.__lawrenceCache = {
      policyStore,
      cache,
      manager: cache.manager,
      registry: cache.registry,
      resolver: cache.manager.resolver,
      metrics: new CacheMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceCache;
}

/**
 * Register the PromptCache middleware into the execution chain and subscribe the
 * cache metrics collector to the bus. Idempotent. Optionally applies an initial
 * policy.
 */
export function installPromptCache(policy?: CachePolicy): CacheStack {
  const stack = cachePlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    registerExecutionHook(stack.cache);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
