// Unified Cache Platform (Milestone 7.5) — wiring.
//
// Builds the process-wide cache platform and attaches it to the execution chain
// as the outermost middleware (the CacheManager, priority 0), with its metrics
// collector subscribed to the shared bus. The ExactMatchCacheStore is registered
// as the only active store; future stores register on `stack.registry` with no
// pipeline changes. Idempotent. The default policy is DISABLED, so installing it
// changes nothing until a tenant enables caching.

import { registerExecutionHook } from "@/lib/aiops/execution/execution-hooks";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { CacheManager } from "./cache-manager";
import { CacheRegistry } from "./cache-registry";
import { CacheResolver } from "./cache-resolver";
import { ExactMatchCacheStore } from "./exact-match-cache-store";
import { CacheMetricsCollector } from "./cache-metrics";
import { CachePolicyStore, type CachePolicy } from "./cache-types";

export interface CacheStack {
  policyStore: CachePolicyStore;
  registry: CacheRegistry;
  resolver: CacheResolver;
  manager: CacheManager;
  metrics: CacheMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceCache?: CacheStack };

export function cachePlatform(): CacheStack {
  if (!globalRef.__lawrenceCache) {
    const policyStore = new CachePolicyStore();
    const registry = new CacheRegistry();
    registry.register(new ExactMatchCacheStore());
    const resolver = new CacheResolver(registry);
    globalRef.__lawrenceCache = {
      policyStore,
      registry,
      resolver,
      manager: new CacheManager({ bus: observability().bus, policyStore, registry, resolver }),
      metrics: new CacheMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceCache;
}

/**
 * Register the cache manager middleware into the execution chain and subscribe
 * its metrics collector to the bus. Idempotent. Optionally applies an initial
 * policy.
 */
export function installPromptCache(policy?: CachePolicy): CacheStack {
  const stack = cachePlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    registerExecutionHook(stack.manager);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
