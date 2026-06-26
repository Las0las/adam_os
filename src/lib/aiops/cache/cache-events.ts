// Prompt Cache Middleware (Milestone 7.0) — canonical cache events.
//
// Published onto the shared Execution Event Bus so cache activity is observable
// through the existing telemetry/audit subscribers, and counted by the passive
// cache metrics collector. Events carry the execution identity fields plus a
// short, non-reversible key digest (never the prompt) and timing/size facts.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type CacheEventType =
  | "cache.hit"
  | "cache.miss"
  | "cache.store"
  | "cache.expired";

export interface CacheEventBase {
  type: CacheEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
  /** Short digest of the cache key — correlates events without leaking prompts. */
  keyDigest: string;
}

export interface CacheHitEvent extends CacheEventBase {
  type: "cache.hit";
  /** Lookup time in milliseconds. */
  lookupMs: number;
  hitCount: number;
}

export interface CacheMissEvent extends CacheEventBase {
  type: "cache.miss";
  lookupMs: number;
}

export interface CacheStoreEvent extends CacheEventBase {
  type: "cache.store";
  entryCount: number;
}

export interface CacheExpiredEvent extends CacheEventBase {
  type: "cache.expired";
  reason: "ttl" | "capacity";
  entryCount: number;
}

export type CacheEvent = CacheHitEvent | CacheMissEvent | CacheStoreEvent | CacheExpiredEvent;

export function isCacheEvent(event: { type: string }): event is CacheEvent {
  return event.type.startsWith("cache.");
}

function base(type: CacheEventType, ctx: InferenceExecutionContext, keyDigest: string): CacheEventBase {
  return {
    type,
    executionId: ctx.executionId,
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    provider: ctx.provider,
    model: ctx.model,
    workloadType: ctx.workloadType,
    timestamp: observedNowMs(),
    keyDigest,
  };
}

export function cacheHit(ctx: InferenceExecutionContext, keyDigest: string, lookupMs: number, hitCount: number): CacheHitEvent {
  return deepFreeze({ ...base("cache.hit", ctx, keyDigest), type: "cache.hit" as const, lookupMs, hitCount });
}

export function cacheMiss(ctx: InferenceExecutionContext, keyDigest: string, lookupMs: number): CacheMissEvent {
  return deepFreeze({ ...base("cache.miss", ctx, keyDigest), type: "cache.miss" as const, lookupMs });
}

export function cacheStore(ctx: InferenceExecutionContext, keyDigest: string, entryCount: number): CacheStoreEvent {
  return deepFreeze({ ...base("cache.store", ctx, keyDigest), type: "cache.store" as const, entryCount });
}

export function cacheExpired(
  ctx: InferenceExecutionContext,
  keyDigest: string,
  reason: "ttl" | "capacity",
  entryCount: number,
): CacheExpiredEvent {
  return deepFreeze({ ...base("cache.expired", ctx, keyDigest), type: "cache.expired" as const, reason, entryCount });
}
