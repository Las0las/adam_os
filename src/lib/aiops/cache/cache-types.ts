// Prompt Cache Middleware (Milestone 7.0) — policy + entry contracts.
//
// Exact-match, in-memory caching only. No semantic cache, no embeddings, no
// persistence, no distributed cache. The default policy is DISABLED so installing
// the middleware changes nothing until a tenant opts in (caching can serve stale
// results, so it is opt-in rather than on-by-default). Policies are immutable
// during an execution: the store hands out a deep-frozen snapshot and
// reconfiguration replaces it wholesale.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { CompletionResponse } from "@/lib/aiops/models/model-provider";

export type CacheMode = "disabled" | "enabled";

export interface CachePolicy {
  mode: CacheMode;
  /** Time-to-live for an entry, in milliseconds. */
  ttlMs: number;
  /** Maximum number of entries; the oldest is evicted past this bound. */
  maxEntries: number;
  /** Workload types eligible for caching. Empty = all workloads. */
  cacheableWorkloads: string[];
  /** Providers eligible for caching (by registry id). Empty = all (Milestone 7.5). */
  providerFilters: string[];
  /** Models eligible for caching (by model key). Empty = all (Milestone 7.5). */
  modelFilters: string[];
  /** Cache store names to consult, in this order. Empty = all registered stores
   *  in registration order (Milestone 7.5). */
  cacheStores: string[];
  /** When true, skip the cache entirely for this execution (no read, no write). */
  bypass: boolean;
}

/** Default policy: caching OFF. Enabling is a per-tenant decision. */
export function defaultCachePolicy(): CachePolicy {
  return {
    mode: "disabled",
    ttlMs: 5 * 60 * 1000,
    maxEntries: 1000,
    cacheableWorkloads: [],
    providerFilters: [],
    modelFilters: [],
    cacheStores: [],
    bypass: false,
  };
}

/**
 * Canonical cache entry. The cached `response` is deep-frozen so a cached
 * execution result can never be mutated by a consumer. `hitCount`, `createdAt`,
 * and `expiresAt` are entry metadata (not part of the immutable result).
 */
export interface CacheEntry {
  key: string;
  response: CompletionResponse;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

/** Holds the active cache policy as an immutable snapshot. */
export class CachePolicyStore {
  private policy: CachePolicy;

  constructor(policy: CachePolicy = defaultCachePolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): CachePolicy {
    return this.policy;
  }

  configure(policy: CachePolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/** Chain position: the cache runs FIRST (before the security middleware at 1-3
 *  and the publisher at 10), so its lookup precedes everything else. */
export const CACHE_PRIORITY = 0;
