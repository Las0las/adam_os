// Unified Cache Platform (Milestone 7.5, deliverable #7) — canonical cache events.
//
// Published by the CacheManager onto the shared Execution Event Bus so cache
// activity is observable through the existing telemetry/audit subscribers and
// counted by the passive cache metrics collector. Milestone 7.0's hit/miss/store/
// expired events are retained (now carrying a `store` attribution), and three
// orchestration events are added: store-selected, lookup-started, lookup-completed.
// Events never carry prompt or response text — only a key digest and facts.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";

export type CacheEventType =
  | "cache.hit"
  | "cache.miss"
  | "cache.store"
  | "cache.expired"
  | "cache.store_selected"
  | "cache.lookup_started"
  | "cache.lookup_completed";

export interface CacheEventBase {
  type: CacheEventType;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
  /** Short digest of the cache key ("" for whole-lookup orchestration events). */
  keyDigest: string;
}

export interface CacheHitEvent extends CacheEventBase {
  type: "cache.hit";
  store: string;
  lookupMs: number;
  hitCount: number;
}

export interface CacheMissEvent extends CacheEventBase {
  type: "cache.miss";
  store: string;
  lookupMs: number;
}

export interface CacheStoreEvent extends CacheEventBase {
  type: "cache.store";
  store: string;
  entryCount: number;
  storeMs: number;
  capacity: number;
}

export interface CacheExpiredEvent extends CacheEventBase {
  type: "cache.expired";
  store: string;
  reason: "ttl" | "capacity";
  entryCount: number;
  capacity: number;
}

export interface CacheStoreSelectedEvent extends CacheEventBase {
  type: "cache.store_selected";
  store: string;
  operation: "lookup" | "store";
}

export interface CacheLookupStartedEvent extends CacheEventBase {
  type: "cache.lookup_started";
  /** Number of eligible stores that will be consulted. */
  storeCount: number;
}

export interface CacheLookupCompletedEvent extends CacheEventBase {
  type: "cache.lookup_completed";
  hit: boolean;
  lookupMs: number;
  /** The store that served the hit, or null on a miss. */
  store: string | null;
}

export type CacheEvent =
  | CacheHitEvent
  | CacheMissEvent
  | CacheStoreEvent
  | CacheExpiredEvent
  | CacheStoreSelectedEvent
  | CacheLookupStartedEvent
  | CacheLookupCompletedEvent;

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

export function cacheHit(ctx: InferenceExecutionContext, store: string, keyDigest: string, lookupMs: number, hitCount: number): CacheHitEvent {
  return deepFreeze({ ...base("cache.hit", ctx, keyDigest), type: "cache.hit" as const, store, lookupMs, hitCount });
}

export function cacheMiss(ctx: InferenceExecutionContext, store: string, keyDigest: string, lookupMs: number): CacheMissEvent {
  return deepFreeze({ ...base("cache.miss", ctx, keyDigest), type: "cache.miss" as const, store, lookupMs });
}

export function cacheStore(ctx: InferenceExecutionContext, store: string, keyDigest: string, entryCount: number, storeMs: number, capacity: number): CacheStoreEvent {
  return deepFreeze({ ...base("cache.store", ctx, keyDigest), type: "cache.store" as const, store, entryCount, storeMs, capacity });
}

export function cacheExpired(ctx: InferenceExecutionContext, store: string, keyDigest: string, reason: "ttl" | "capacity", entryCount: number, capacity: number): CacheExpiredEvent {
  return deepFreeze({ ...base("cache.expired", ctx, keyDigest), type: "cache.expired" as const, store, reason, entryCount, capacity });
}

export function cacheStoreSelected(ctx: InferenceExecutionContext, store: string, operation: "lookup" | "store"): CacheStoreSelectedEvent {
  return deepFreeze({ ...base("cache.store_selected", ctx, ""), type: "cache.store_selected" as const, store, operation });
}

export function cacheLookupStarted(ctx: InferenceExecutionContext, storeCount: number): CacheLookupStartedEvent {
  return deepFreeze({ ...base("cache.lookup_started", ctx, ""), type: "cache.lookup_started" as const, storeCount });
}

export function cacheLookupCompleted(ctx: InferenceExecutionContext, hit: boolean, lookupMs: number, store: string | null): CacheLookupCompletedEvent {
  return deepFreeze({ ...base("cache.lookup_completed", ctx, ""), type: "cache.lookup_completed" as const, hit, lookupMs, store });
}
