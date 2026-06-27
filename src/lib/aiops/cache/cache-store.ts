// Unified Cache Platform (Milestone 7.5, deliverable #2) — CacheStore contract.
//
// A provider-independent storage strategy. The CacheManager talks only to this
// interface, so the execution pipeline never knows whether a request is served
// by an exact-match map, a semantic index, Redis, or any future implementation.
// A store performs its own keying (exact stores hash the request; a semantic
// store would embed it) and never touches the event bus — the manager owns event
// publication, keeping stores pure and transport-agnostic. Methods may be async
// so out-of-process stores (Redis, distributed) plug in without pipeline changes.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import type { CachePolicy } from "./cache-types";

/** Outcome of a single store lookup. */
export interface CacheLookupOutcome {
  hit: boolean;
  /** The cached response (immutable) on a hit, else null. */
  response: CompletionResponse | null;
  /** The entry's hit count after this lookup (for the CacheHit event). */
  hitCount: number;
  /** True when an expired entry was found and removed during this lookup. */
  expiredRemoved: boolean;
  /** Live entry count after the lookup (post any expiry removal). */
  entryCount: number;
  /** Short, non-reversible digest of the computed key (for events). */
  keyDigest: string;
}

/** Outcome of a single store write. */
export interface CacheStoreOutcome {
  stored: boolean;
  /** Live entry count after the write (post any capacity eviction). */
  entryCount: number;
  /** Digests of entries evicted to honor the capacity bound (one CacheExpired
   *  each, reason "capacity"). */
  evictedDigests: string[];
  keyDigest: string;
}

/** Passive per-store statistics. */
export interface CacheStoreStatistics {
  store: string;
  entryCount: number;
  maxEntries: number;
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
}

/** A pluggable cache storage strategy. */
export interface CacheStore {
  /** Stable, unique store name (used for selection, events, and metrics). */
  name: string;
  lookup(
    request: CompletionRequest,
    ctx: InferenceExecutionContext,
    policy: CachePolicy,
  ): CacheLookupOutcome | Promise<CacheLookupOutcome>;
  store(
    request: CompletionRequest,
    response: CompletionResponse,
    ctx: InferenceExecutionContext,
    policy: CachePolicy,
  ): CacheStoreOutcome | Promise<CacheStoreOutcome>;
  remove(request: CompletionRequest, ctx: InferenceExecutionContext): boolean | Promise<boolean>;
  clear(): void | Promise<void>;
  statistics(): CacheStoreStatistics;
}
