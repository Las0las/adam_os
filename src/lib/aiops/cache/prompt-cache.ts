// Prompt Cache (Milestone 7.0; refactored onto the cache platform in 7.5).
//
// Since Milestone 7.5 the prompt cache is just a preconfigured CacheManager: a
// registry containing a single ExactMatchCacheStore. The actual storage logic now
// lives in ExactMatchCacheStore, and the pipeline talks to the CacheManager
// contract. PromptCache is retained as a thin, backward-compatible facade with
// the original (bus, policyStore, now) constructor and "prompt-cache" middleware
// name — its behavior is identical to Milestone 7.0.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext, ExecutionHook } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { CACHE_PRIORITY, type CachePolicyStore } from "./cache-types";
import { CacheManager } from "./cache-manager";
import { CacheRegistry } from "./cache-registry";
import { ExactMatchCacheStore } from "./exact-match-cache-store";

export class PromptCache implements ExecutionHook {
  readonly name = "prompt-cache";
  readonly priority = CACHE_PRIORITY;

  /** The CacheManager this middleware delegates to (exposed so the platform and
   *  future cache stores share the same manager/registry). */
  readonly manager: CacheManager;
  private readonly exact: ExactMatchCacheStore;

  constructor(bus: ExecutionEventBus, policyStore: CachePolicyStore, now: () => number = observedNowMs) {
    this.exact = new ExactMatchCacheStore(now);
    const registry = new CacheRegistry();
    registry.register(this.exact);
    this.manager = new CacheManager({ bus, policyStore, registry, name: "prompt-cache" });
  }

  /** The shared cache registry — future CacheStore implementations register here. */
  get registry(): CacheRegistry {
    return this.manager.registry;
  }

  resolveCompletion(request: CompletionRequest, ctx: InferenceExecutionContext): Promise<CompletionResponse | null> {
    return this.manager.resolveCompletion(request, ctx);
  }

  recordCompletion(request: CompletionRequest, response: CompletionResponse, ctx: InferenceExecutionContext): Promise<void> {
    return this.manager.recordCompletion(request, response, ctx);
  }

  /** Live entry count (exact-match store). */
  size(): number {
    return this.exact.size();
  }

  clear(): void {
    this.exact.clear();
  }
}
