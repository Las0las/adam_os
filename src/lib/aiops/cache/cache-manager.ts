// Unified Cache Platform (Milestone 7.5, deliverable #1) — CacheManager.
//
// The ONLY cache component the execution pipeline communicates with. It owns:
//   • policy evaluation (enabled / bypass / workload + provider + model filters)
//   • store selection (via the CacheResolver over the CacheRegistry)
//   • lookup (first valid hit wins, deterministic order) and store (write-through)
//   • all event publication
//
// The pipeline never knows which store served a request — exact-match, semantic,
// Redis, or any future implementation. It attaches as execution middleware via
// `resolveCompletion` (lookup, may short-circuit only the provider) and
// `recordCompletion` (write-through). It NEVER bypasses security: the firewall,
// PII redaction, and validator still run around a cache hit (see the pipeline).

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext, ExecutionHook } from "@/lib/aiops/execution/execution-types";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import {
  cacheHit,
  cacheMiss,
  cacheStore,
  cacheExpired,
  cacheStoreSelected,
  cacheLookupStarted,
  cacheLookupCompleted,
} from "./cache-events";
import { CACHE_PRIORITY, type CachePolicy, type CachePolicyStore } from "./cache-types";
import type { CacheStore, CacheStoreStatistics } from "./cache-store";
import { CacheRegistry } from "./cache-registry";
import { CacheResolver } from "./cache-resolver";

/** High-resolution clock for latency measurement, guarded. */
function hrNow(): number {
  try {
    return typeof performance !== "undefined" ? performance.now() : observedNowMs();
  } catch {
    return observedNowMs();
  }
}

export interface CacheManagerOptions {
  bus: ExecutionEventBus;
  policyStore: CachePolicyStore;
  registry: CacheRegistry;
  resolver?: CacheResolver;
  name?: string;
}

export class CacheManager implements ExecutionHook {
  readonly name: string;
  readonly priority = CACHE_PRIORITY;

  readonly registry: CacheRegistry;
  readonly resolver: CacheResolver;
  readonly policyStore: CachePolicyStore;
  private readonly bus: ExecutionEventBus;

  constructor(opts: CacheManagerOptions) {
    this.bus = opts.bus;
    this.policyStore = opts.policyStore;
    this.registry = opts.registry;
    this.resolver = opts.resolver ?? new CacheResolver(opts.registry);
    this.name = opts.name ?? "cache-manager";
  }

  /** Whether this execution is eligible for caching at all (policy gates). */
  private isCacheable(policy: CachePolicy, ctx: InferenceExecutionContext): boolean {
    if (policy.mode !== "enabled" || policy.bypass) return false;
    if (policy.cacheableWorkloads.length > 0 && !policy.cacheableWorkloads.includes(ctx.workloadType)) return false;
    if (policy.providerFilters.length > 0 && !policy.providerFilters.includes(ctx.provider)) return false;
    if (policy.modelFilters.length > 0 && !policy.modelFilters.includes(ctx.model)) return false;
    return true;
  }

  // ── ExecutionHook surface (the pipeline calls only these) ──────────────────

  resolveCompletion(request: CompletionRequest, ctx: InferenceExecutionContext): Promise<CompletionResponse | null> {
    return this.lookup(request, ctx);
  }

  recordCompletion(request: CompletionRequest, response: CompletionResponse, ctx: InferenceExecutionContext): Promise<void> {
    return this.store(request, response, ctx);
  }

  // ── Public cache operations ────────────────────────────────────────────────

  /** Consult eligible stores in order; return the first valid hit (or null).
   *  Publishes lookup/store-selected/hit/miss/expired events. Emits NOTHING when
   *  the execution is not cacheable (disabled / bypassed / filtered). */
  async lookup(request: CompletionRequest, ctx: InferenceExecutionContext): Promise<CompletionResponse | null> {
    const policy = this.policyStore.current();
    if (!this.isCacheable(policy, ctx)) return null;

    const stores = this.resolver.resolve(policy);
    guard(() => this.bus.publish(cacheLookupStarted(ctx, stores.length)));
    const t0 = hrNow();

    for (const s of stores) {
      const o = await s.lookup(request, ctx, policy);
      if (o.expiredRemoved) {
        guard(() => this.bus.publish(cacheExpired(ctx, s.name, o.keyDigest, "ttl", o.entryCount, policy.maxEntries)));
      }
      if (o.hit) {
        const lookupMs = hrNow() - t0;
        guard(() => this.bus.publish(cacheStoreSelected(ctx, s.name, "lookup")));
        guard(() => this.bus.publish(cacheHit(ctx, s.name, o.keyDigest, lookupMs, o.hitCount)));
        guard(() => this.bus.publish(cacheLookupCompleted(ctx, true, lookupMs, s.name)));
        return o.response;
      }
      guard(() => this.bus.publish(cacheMiss(ctx, s.name, o.keyDigest, hrNow() - t0)));
    }

    const lookupMs = hrNow() - t0;
    guard(() => this.bus.publish(cacheLookupCompleted(ctx, false, lookupMs, null)));
    return null;
  }

  /** Write a fresh response through to every eligible store. */
  async store(request: CompletionRequest, response: CompletionResponse, ctx: InferenceExecutionContext): Promise<void> {
    const policy = this.policyStore.current();
    if (!this.isCacheable(policy, ctx)) return;

    for (const s of this.resolver.resolve(policy)) {
      guard(() => this.bus.publish(cacheStoreSelected(ctx, s.name, "store")));
      const t0 = hrNow();
      const o = await s.store(request, response, ctx, policy);
      const storeMs = hrNow() - t0;
      if (o.stored) {
        guard(() => this.bus.publish(cacheStore(ctx, s.name, o.keyDigest, o.entryCount, storeMs, policy.maxEntries)));
      }
      for (const digest of o.evictedDigests) {
        guard(() => this.bus.publish(cacheExpired(ctx, s.name, digest, "capacity", o.entryCount, policy.maxEntries)));
      }
    }
  }

  /** Per-store statistics across the registry. */
  statistics(): CacheStoreStatistics[] {
    return this.registry.list().map((s) => s.statistics());
  }

  /** Clear every registered store (test isolation). */
  clear(): void {
    for (const s of this.registry.list()) void (s as CacheStore).clear();
  }
}
