// Prompt Cache Middleware (Milestone 7.0) — wiring.
//
// Builds the process-wide prompt cache and attaches it to the execution chain as
// the FIRST middleware (priority 0), with its metrics collector subscribed to the
// shared bus. Idempotent. The default policy is DISABLED, so installing it
// changes nothing until a tenant enables caching via the policy store.
//
//   pipeline ─▶ Prompt Cache (0) ─▶ Prompt Firewall (1) ─▶ PII Redaction (2)
//                  │ lookup/store                              │
//                  ▼                                           ▼
//        Execution Event Bus ◀── cache events            Provider ─▶ Validator (3)
//                  ▼
//            Cache Metrics (subscriber)

import { registerExecutionHook } from "@/lib/aiops/execution/execution-hooks";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { PromptCache } from "./prompt-cache";
import { CacheMetricsCollector } from "./cache-metrics";
import { CachePolicyStore, type CachePolicy } from "./cache-types";

export interface CacheStack {
  store: CachePolicyStore;
  cache: PromptCache;
  metrics: CacheMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceCache?: CacheStack };

export function promptCache(): CacheStack {
  if (!globalRef.__lawrenceCache) {
    const store = new CachePolicyStore();
    globalRef.__lawrenceCache = {
      store,
      cache: new PromptCache(observability().bus, store),
      metrics: new CacheMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceCache;
}

/**
 * Register the prompt cache middleware into the execution chain and subscribe its
 * metrics collector to the bus. Idempotent. Optionally applies an initial policy.
 */
export function installPromptCache(policy?: CachePolicy): CacheStack {
  const stack = promptCache();
  if (policy) stack.store.configure(policy);
  if (!stack.installed) {
    registerExecutionHook(stack.cache);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
