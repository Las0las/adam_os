// Prompt Cache Middleware (Milestone 7.0, deliverables #1, #4) — exact-match,
// in-memory prompt cache.
//
// Attaches as execution middleware. `resolveCompletion` runs FIRST (before the
// security middleware) on the ORIGINAL request and may return a cached response
// to short-circuit the provider; `recordCompletion` stores a fresh, validated
// response. It NEVER bypasses security — the firewall, PII redaction, and
// response validator still run around a cache hit; only the provider call is
// skipped (see the pipeline lifecycle). Keying on the original (pre-redaction)
// request avoids the collision where two distinct prompts mask to the same text.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext, ExecutionHook } from "@/lib/aiops/execution/execution-types";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { fingerprint } from "@/lib/aiops/execution/observability/fingerprint";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { cacheHit, cacheMiss, cacheStore, cacheExpired } from "./cache-events";
import {
  CACHE_PRIORITY,
  type CacheEntry,
  type CachePolicy,
  type CachePolicyStore,
} from "./cache-types";

/** Deterministic JSON with sorted keys (so object key order never affects the
 *  cache key). */
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

/** High-resolution clock for lookup timing, guarded. */
function hrNow(): number {
  try {
    return typeof performance !== "undefined" ? performance.now() : observedNowMs();
  } catch {
    return observedNowMs();
  }
}

export class PromptCache implements ExecutionHook {
  readonly name = "prompt-cache";
  readonly priority = CACHE_PRIORITY;

  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: CachePolicyStore,
    /** Injectable clock (epoch ms) so TTL is testable. */
    private readonly now: () => number = observedNowMs,
  ) {}

  /** The full, collision-free cache key. MUST include provider, model, the
   *  normalized request, and the response format / tool definitions. (The
   *  platform's CompletionRequest folds system prompt into `prompt` and expresses
   *  response format / tools as `outputSchema`; temperature/top_p are not part of
   *  the request type and so are absent — additional fields are picked up
   *  automatically as the request type grows.) */
  private keyFor(ctx: InferenceExecutionContext, request: CompletionRequest): string {
    return stableStringify({
      provider: ctx.provider,
      model: ctx.model,
      prompt: normalizePrompt(request.prompt),
      responseFormat: request.outputSchema ?? null,
      maxTokens: request.maxTokens ?? null,
    });
  }

  private isCacheable(policy: CachePolicy, ctx: InferenceExecutionContext): boolean {
    if (policy.mode !== "enabled" || policy.bypass) return false;
    return policy.cacheableWorkloads.length === 0 || policy.cacheableWorkloads.includes(ctx.workloadType);
  }

  /** Current number of live entries. */
  size(): number {
    return this.entries.size;
  }

  /** Clear all entries (test isolation). */
  clear(): void {
    this.entries.clear();
  }

  resolveCompletion(request: CompletionRequest, ctx: InferenceExecutionContext): CompletionResponse | null {
    const policy = this.store.current();
    if (!this.isCacheable(policy, ctx)) return null;

    const key = this.keyFor(ctx, request);
    const digest = fingerprint(key);
    const t0 = hrNow();
    const entry = this.entries.get(key);
    const lookupMs = hrNow() - t0;

    if (entry && this.now() <= entry.expiresAt) {
      entry.hitCount += 1;
      // Recency bump (insertion-order Map): re-insert so it is not the next evicted.
      this.entries.delete(key);
      this.entries.set(key, entry);
      guard(() => this.bus.publish(cacheHit(ctx, digest, lookupMs, entry.hitCount)));
      return entry.response;
    }

    if (entry) {
      // Expired — drop it and report both the expiry and the resulting miss.
      this.entries.delete(key);
      guard(() => this.bus.publish(cacheExpired(ctx, digest, "ttl", this.entries.size)));
    }
    guard(() => this.bus.publish(cacheMiss(ctx, digest, lookupMs)));
    return null;
  }

  recordCompletion(request: CompletionRequest, response: CompletionResponse, ctx: InferenceExecutionContext): void {
    const policy = this.store.current();
    if (!this.isCacheable(policy, ctx)) return;

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
    guard(() => this.bus.publish(cacheStore(ctx, digest, this.entries.size)));

    // Evict oldest entries past the capacity bound (simple, non-adaptive).
    while (this.entries.size > policy.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      guard(() => this.bus.publish(cacheExpired(ctx, fingerprint(oldest), "capacity", this.entries.size)));
    }
  }
}
