// Unified Cache Platform (Milestone 7.5, deliverable #3) — ExactMatchCacheStore.
//
// The original Milestone 7.0 prompt cache, refactored into a CacheStore. Behavior
// is identical: an in-memory, exact-match map keyed on provider + model +
// normalized request + response format + maxTokens, with TTL and oldest-first
// capacity eviction. It is now a pure store — no event-bus dependency (the
// CacheManager publishes events) — so it composes with the cache platform.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { fingerprint } from "@/lib/aiops/execution/observability/fingerprint";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { CachePolicy, CacheEntry } from "./cache-types";
import type {
  CacheStore,
  CacheLookupOutcome,
  CacheStoreOutcome,
  CacheStoreStatistics,
} from "./cache-store";

/** Deterministic JSON with sorted keys (object key order never affects the key). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Minimal, exact-match normalization: normalize line endings and trim outer
 *  whitespace. Internal content is preserved verbatim (this is exact caching). */
function normalizePrompt(prompt: string): string {
  return (prompt ?? "").replace(/\r\n/g, "\n").trim();
}

export class ExactMatchCacheStore implements CacheStore {
  readonly name = "exact-match";

  private readonly entries = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private stores = 0;
  private evictions = 0;

  constructor(
    /** Injectable clock (epoch ms) so TTL is testable. */
    private readonly now: () => number = observedNowMs,
  ) {}

  /** The full, collision-free cache key. Includes provider, model, the normalized
   *  request, response format / tool definitions, and maxTokens. */
  private keyFor(ctx: InferenceExecutionContext, request: CompletionRequest): string {
    return stableStringify({
      provider: ctx.provider,
      model: ctx.model,
      prompt: normalizePrompt(request.prompt),
      responseFormat: request.outputSchema ?? null,
      maxTokens: request.maxTokens ?? null,
    });
  }

  lookup(request: CompletionRequest, ctx: InferenceExecutionContext, _policy?: CachePolicy): CacheLookupOutcome {
    const key = this.keyFor(ctx, request);
    const digest = fingerprint(key);
    const entry = this.entries.get(key);

    if (entry && this.now() <= entry.expiresAt) {
      entry.hitCount += 1;
      // Recency bump (insertion-order Map): re-insert so it is not next evicted.
      this.entries.delete(key);
      this.entries.set(key, entry);
      this.hits += 1;
      return { hit: true, response: entry.response, hitCount: entry.hitCount, expiredRemoved: false, entryCount: this.entries.size, keyDigest: digest };
    }

    let expiredRemoved = false;
    if (entry) {
      this.entries.delete(key);
      expiredRemoved = true;
    }
    this.misses += 1;
    return { hit: false, response: null, hitCount: 0, expiredRemoved, entryCount: this.entries.size, keyDigest: digest };
  }

  store(request: CompletionRequest, response: CompletionResponse, ctx: InferenceExecutionContext, policy: CachePolicy): CacheStoreOutcome {
    const key = this.keyFor(ctx, request);
    const digest = fingerprint(key);
    const createdAt = this.now();
    const entry: CacheEntry = {
      key,
      response: deepFreeze({ ...response }),
      createdAt,
      expiresAt: createdAt + policy.ttlMs,
      hitCount: 0,
    };
    this.entries.set(key, entry);
    this.stores += 1;

    const evictedDigests: string[] = [];
    while (this.entries.size > policy.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.evictions += 1;
      evictedDigests.push(fingerprint(oldest));
    }
    return { stored: true, entryCount: this.entries.size, evictedDigests, keyDigest: digest };
  }

  remove(request: CompletionRequest, ctx: InferenceExecutionContext): boolean {
    return this.entries.delete(this.keyFor(ctx, request));
  }

  clear(): void {
    this.entries.clear();
  }

  /** Live entry count. */
  size(): number {
    return this.entries.size;
  }

  statistics(): CacheStoreStatistics {
    return {
      store: this.name,
      entryCount: this.entries.size,
      maxEntries: Number.POSITIVE_INFINITY,
      hits: this.hits,
      misses: this.misses,
      stores: this.stores,
      evictions: this.evictions,
    };
  }
}
