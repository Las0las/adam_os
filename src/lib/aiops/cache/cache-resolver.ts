// Unified Cache Platform (Milestone 7.5, deliverable #4) — CacheResolver.
//
// Determines which registered cache stores are eligible for a given policy and
// in what order they are consulted. Ordering is deterministic: when the policy
// names stores (`cacheStores`), they are consulted in THAT order (and only those
// that are registered); otherwise all registered stores are consulted in
// registration order. The manager queries them in order and returns the first
// valid hit. Only the ExactMatchCacheStore is active this milestone; a future
// SemanticCacheStore plugs in by registering and being named in the policy.

import type { CacheStore } from "./cache-store";
import type { CacheRegistry } from "./cache-registry";
import type { CachePolicy } from "./cache-types";

export class CacheResolver {
  constructor(private readonly registry: CacheRegistry) {}

  /** Eligible stores in deterministic lookup order. */
  resolve(policy: CachePolicy): CacheStore[] {
    if (policy.cacheStores.length === 0) return this.registry.list();
    // Honor the policy's order; skip names that are not registered.
    const resolved: CacheStore[] = [];
    for (const name of policy.cacheStores) {
      const store = this.registry.get(name);
      if (store) resolved.push(store);
    }
    return resolved;
  }
}
