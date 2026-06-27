// IOS-009 — Semantic Cache — SemanticCacheStore.
//
// An additional CacheStore (IOS-007) that serves a cached response when a new
// request is *semantically* similar to a stored one within the SAME
// compatibility group (provider + model + workload + response format) and the
// cosine similarity meets the confidence threshold. It plugs into the Cache
// Platform purely by being registered on the CacheRegistry — the CacheManager,
// Execution Pipeline, and PromptCache middleware are unmodified.
//
// Compatibility (never cross-provider — out of scope): entries are grouped by
// provider|model|workload|responseFormat. Only within a group is similarity
// considered. On a miss the manager continues to the next store (ExactMatch) and
// then the provider, exactly as before.
//
// The store publishes its OWN semantic.* events (with similarity detail); the
// canonical cache.* events for the "semantic" store are still published by the
// CacheManager, so IOS-007's "manager owns canonical cache events" invariant
// holds and per-store cache metrics keep working.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { fingerprint } from "@/lib/aiops/execution/observability/fingerprint";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import type {
  CacheStore,
  CacheLookupOutcome,
  CacheStoreOutcome,
  CacheStoreStatistics,
} from "./cache-store";
import type { CachePolicy } from "./cache-types";
import { SEMANTIC_STORE_NAME, type SimilarityPolicyStore } from "./semantic-types";
import { HashingEmbedder, cosineSimilarity, type Embedder } from "./semantic-embedder";
import { semanticHit, semanticMiss, semanticStored } from "./semantic-events";

interface SemanticEntry {
  compatKey: string;
  embedding: number[];
  response: CompletionResponse;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

/** Compatibility key: requests are only semantically comparable within the same
 *  provider/model/workload/response-format. */
function compatKeyOf(ctx: InferenceExecutionContext, request: CompletionRequest): string {
  return [ctx.provider, ctx.model, ctx.workloadType, fingerprint(request.outputSchema ?? null)].join("|");
}

export class SemanticCacheStore implements CacheStore {
  readonly name = SEMANTIC_STORE_NAME;

  private entries: SemanticEntry[] = [];
  private hits = 0;
  private misses = 0;
  private stores = 0;
  private evictions = 0;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly policy: SimilarityPolicyStore,
    private readonly embedder: Embedder = new HashingEmbedder(),
    private readonly now: () => number = observedNowMs,
  ) {}

  /** Drop expired entries; returns true if any were removed. */
  private evictExpired(): boolean {
    const t = this.now();
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => t <= e.expiresAt);
    return this.entries.length !== before;
  }

  lookup(request: CompletionRequest, ctx: InferenceExecutionContext): CacheLookupOutcome {
    const sim = this.policy.current();
    const compatKey = compatKeyOf(ctx, request);
    const digest = fingerprint(compatKey);
    const expiredRemoved = this.evictExpired();

    if (!sim.enabled) {
      this.misses += 1;
      return { hit: false, response: null, hitCount: 0, expiredRemoved, entryCount: this.entries.length, keyDigest: digest };
    }

    const query = this.embedder.embed(request.prompt);
    let best: SemanticEntry | null = null;
    let bestSim = 0;
    for (const entry of this.entries) {
      if (entry.compatKey !== compatKey) continue;
      const s = cosineSimilarity(query, entry.embedding);
      if (s > bestSim) { bestSim = s; best = entry; }
    }

    if (best && bestSim >= sim.threshold) {
      best.hitCount += 1;
      // Recency bump (oldest-first eviction): move the matched entry to the end.
      this.entries = this.entries.filter((e) => e !== best);
      this.entries.push(best);
      this.hits += 1;
      guard(() => this.bus.publish(semanticHit(ctx, digest, bestSim, sim.threshold)));
      return { hit: true, response: best.response, hitCount: best.hitCount, expiredRemoved, entryCount: this.entries.length, keyDigest: digest };
    }

    this.misses += 1;
    guard(() => this.bus.publish(semanticMiss(ctx, digest, bestSim, sim.threshold)));
    return { hit: false, response: null, hitCount: 0, expiredRemoved, entryCount: this.entries.length, keyDigest: digest };
  }

  store(request: CompletionRequest, response: CompletionResponse, ctx: InferenceExecutionContext, policy: CachePolicy): CacheStoreOutcome {
    const sim = this.policy.current();
    const compatKey = compatKeyOf(ctx, request);
    const digest = fingerprint(compatKey);
    if (!sim.enabled) {
      return { stored: false, entryCount: this.entries.length, evictedDigests: [], keyDigest: digest };
    }

    const createdAt = this.now();
    this.entries.push({
      compatKey,
      embedding: this.embedder.embed(request.prompt),
      response: deepFreeze({ ...response }),
      createdAt,
      expiresAt: createdAt + policy.ttlMs,
      hitCount: 0,
    });
    this.stores += 1;

    const evictedDigests: string[] = [];
    while (this.entries.length > policy.maxEntries) {
      const oldest = this.entries.shift();
      if (!oldest) break;
      this.evictions += 1;
      evictedDigests.push(fingerprint(oldest.compatKey));
    }
    guard(() => this.bus.publish(semanticStored(ctx, digest, this.entries.length)));
    return { stored: true, entryCount: this.entries.length, evictedDigests, keyDigest: digest };
  }

  /** Remove entries identical to this request (same group, similarity ~1). */
  remove(request: CompletionRequest, ctx: InferenceExecutionContext): boolean {
    const compatKey = compatKeyOf(ctx, request);
    const query = this.embedder.embed(request.prompt);
    const before = this.entries.length;
    this.entries = this.entries.filter(
      (e) => !(e.compatKey === compatKey && cosineSimilarity(query, e.embedding) >= 0.999),
    );
    return this.entries.length !== before;
  }

  clear(): void {
    this.entries = [];
  }

  size(): number {
    return this.entries.length;
  }

  statistics(): CacheStoreStatistics {
    return {
      store: this.name,
      entryCount: this.entries.length,
      maxEntries: Number.POSITIVE_INFINITY,
      hits: this.hits,
      misses: this.misses,
      stores: this.stores,
      evictions: this.evictions,
    };
  }
}
