// Unified Cache Platform (Milestone 7.5). The execution pipeline talks only to a
// CacheManager; cache stores plug in via a CacheStore interface, register in a
// CacheRegistry, and are ordered by a CacheResolver. These tests cover the
// manager, registry ordering, resolver ordering, multi-store lookup, immutable
// contracts, deterministic lookup, and pipeline independence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionRequest, CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";
import { ExecutionTelemetryEngine } from "@/lib/aiops/execution/observability/telemetry-engine";
import { CacheManager } from "@/lib/aiops/cache/cache-manager";
import { CacheRegistry } from "@/lib/aiops/cache/cache-registry";
import { CacheResolver } from "@/lib/aiops/cache/cache-resolver";
import { ExactMatchCacheStore } from "@/lib/aiops/cache/exact-match-cache-store";
import { CacheMetricsCollector } from "@/lib/aiops/cache/cache-metrics";
import { CachePolicyStore, defaultCachePolicy, type CachePolicy } from "@/lib/aiops/cache/cache-types";
import type {
  CacheStore,
  CacheLookupOutcome,
  CacheStoreOutcome,
  CacheStoreStatistics,
} from "@/lib/aiops/cache/cache-store";

const OK: CompletionResponse = {
  text: "hello", json: null, promptTokens: 5, completionTokens: 3,
  latencyMs: 1, costUsd: 0.01, provider: "p", modelKey: "m",
};

function descriptor(): ModelDescriptor {
  return {
    provider: "p", publisher: "acme", family: "fam", model: "m", version: null,
    contextWindow: 128_000, supportsVision: false, supportsTools: false,
    supportsStreaming: false, supportsJSON: false, supportsReasoning: false,
    supportsEmbeddings: false, pricing: null, deprecated: false,
  };
}

function registryWith(complete: ModelProvider["complete"]): ProviderRegistry {
  const r = createProviderRegistry();
  const adapter: ModelProvider = { provider: "p", modelKey: "m", complete };
  r.register(defineProvider({
    metadata: { id: "p", vendor: "p", displayName: "p", authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
    descriptors: [descriptor()], requiredEnv: [], defaultPriority: 10,
    create: () => adapter, createDefault: () => adapter,
  }));
  return r;
}

function counting(impl: ModelProvider["complete"] = async (_req) => OK) {
  let n = 0;
  const reg = registryWith(async (req) => { n += 1; return impl(req); });
  return { reg, calls: () => n };
}

function decision(): RoutingDecision {
  return { selectedProvider: "p", selectedModel: "m", evaluatedProviders: ["p"], rejectionReasons: [], policySnapshot: {} };
}

function params(registry: ProviderRegistry, prompt: string) {
  return { request: { prompt }, routingDecision: decision(), registry, requestId: "req-1", tenantId: "tnt", workloadType: "chat" };
}

function enabled(overrides: Partial<CachePolicy> = {}): CachePolicy {
  return { ...defaultCachePolicy(), mode: "enabled", ...overrides };
}

function ctx(): InferenceExecutionContext {
  return {
    executionId: "e", requestId: "r", routingDecision: null, provider: "p", model: "m",
    tenantId: "tnt", workloadType: "chat", startTime: 0, requestFingerprint: "fp",
    executionPlan: { targets: [{ provider: "p", model: "m" }] },
  };
}

/** A manager wired over a fresh bus + telemetry + cache metrics. */
function managerWith(stores: CacheStore[], policy: CachePolicy) {
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  const metrics = new CacheMetricsCollector();
  bus.subscribe(telemetry);
  bus.subscribe(metrics);
  const registry = new CacheRegistry();
  for (const s of stores) registry.register(s);
  const policyStore = new CachePolicyStore(policy);
  const manager = new CacheManager({ bus, policyStore, registry });
  const publisher = new ExecutionEventPublisher(bus);
  return { bus, telemetry, metrics, registry, policyStore, manager, publisher, hooks: [manager, publisher] };
}

/** A recording in-memory store that always serves a fixed response. */
function fixedStore(name: string, response: CompletionResponse | null): CacheStore & { lookups: number } {
  const self = {
    name,
    lookups: 0,
    lookup(): CacheLookupOutcome {
      self.lookups += 1;
      return response
        ? { hit: true, response, hitCount: 1, expiredRemoved: false, entryCount: 1, keyDigest: `d-${name}` }
        : { hit: false, response: null, hitCount: 0, expiredRemoved: false, entryCount: 0, keyDigest: `d-${name}` };
    },
    store(): CacheStoreOutcome { return { stored: true, entryCount: 1, evictedDigests: [], keyDigest: `d-${name}` }; },
    remove(): boolean { return false; },
    clear(): void {},
    statistics(): CacheStoreStatistics { return { store: name, entryCount: 0, maxEntries: 0, hits: 0, misses: 0, stores: 0, evictions: 0 }; },
  };
  return self;
}

// ── CacheManager ────────────────────────────────────────────────────────────

test("CacheManager.lookup returns a hit from a registered store", async () => {
  const { manager } = managerWith([fixedStore("s1", OK)], enabled());
  const hit = await manager.lookup({ prompt: "x" }, ctx());
  assert.equal(hit?.text, "hello");
});

test("CacheManager.lookup returns null when no store hits", async () => {
  const { manager } = managerWith([fixedStore("s1", null)], enabled());
  assert.equal(await manager.lookup({ prompt: "x" }, ctx()), null);
});

test("CacheManager emits orchestration events but nothing when disabled", async () => {
  const dis = managerWith([fixedStore("s1", OK)], defaultCachePolicy());
  await dis.manager.lookup({ prompt: "x" }, ctx());
  assert.deepEqual(dis.telemetry.events().map((e) => e.type).filter((t) => t.startsWith("cache.")), []);

  const en = managerWith([fixedStore("s1", OK)], enabled());
  await en.manager.lookup({ prompt: "x" }, ctx());
  const types = en.telemetry.events().map((e) => e.type);
  assert.ok(types.includes("cache.lookup_started"));
  assert.ok(types.includes("cache.store_selected"));
  assert.ok(types.includes("cache.hit"));
  assert.ok(types.includes("cache.lookup_completed"));
});

// ── Registry ──────────────────────────────────────────────────────────────────

test("CacheRegistry preserves registration order; re-register replaces in place", () => {
  const reg = new CacheRegistry();
  const a = fixedStore("a", null);
  const b = fixedStore("b", null);
  reg.register(a);
  reg.register(b);
  assert.deepEqual(reg.list().map((s) => s.name), ["a", "b"]);
  const a2 = fixedStore("a", OK);
  reg.register(a2);
  assert.deepEqual(reg.list().map((s) => s.name), ["a", "b"]); // order kept
  assert.equal(reg.get("a"), a2); // replaced
});

// ── Resolver ────────────────────────────────────────────────────────────────────

test("CacheResolver returns all stores in registration order by default", () => {
  const reg = new CacheRegistry();
  reg.register(fixedStore("a", null));
  reg.register(fixedStore("b", null));
  const resolver = new CacheResolver(reg);
  assert.deepEqual(resolver.resolve(enabled()).map((s) => s.name), ["a", "b"]);
});

test("CacheResolver honors the policy's explicit store order and skips unknown names", () => {
  const reg = new CacheRegistry();
  reg.register(fixedStore("a", null));
  reg.register(fixedStore("b", null));
  const resolver = new CacheResolver(reg);
  const ordered = resolver.resolve(enabled({ cacheStores: ["b", "missing", "a"] }));
  assert.deepEqual(ordered.map((s) => s.name), ["b", "a"]);
});

// ── Multiple stores ─────────────────────────────────────────────────────────────

test("the manager consults stores in order and returns the first hit", async () => {
  const s1 = fixedStore("s1", null); // miss
  const s2 = fixedStore("s2", OK);   // hit
  const s3 = fixedStore("s3", OK);
  const { manager } = managerWith([s1, s2, s3], enabled());
  const hit = await manager.lookup({ prompt: "x" }, ctx());
  assert.equal(hit?.text, "hello");
  assert.equal(s1.lookups, 1, "first store consulted");
  assert.equal(s2.lookups, 1, "second store consulted and hit");
  assert.equal(s3.lookups, 0, "no store consulted after the first hit");
});

test("per-store metrics attribute hits and misses to the right store", async () => {
  const s1 = fixedStore("s1", null);
  const s2 = fixedStore("s2", OK);
  const { manager, metrics } = managerWith([s1, s2], enabled());
  await manager.lookup({ prompt: "x" }, ctx());
  const snap = metrics.snapshot();
  assert.equal(snap.perStore.s1?.misses, 1);
  assert.equal(snap.perStore.s2?.hits, 1);
});

// ── ExactMatchCacheStore compatibility ──────────────────────────────────────────

test("ExactMatchCacheStore stores and serves an identical request", () => {
  const s = new ExactMatchCacheStore(() => 1000);
  const policy = enabled();
  assert.equal(s.lookup({ prompt: "hi" }, ctx(), policy).hit, false);
  s.store({ prompt: "hi" }, OK, ctx(), policy);
  const got = s.lookup({ prompt: "hi" }, ctx(), policy);
  assert.equal(got.hit, true);
  assert.equal(got.response?.text, "hello");
});

test("a cached response is immutable", () => {
  const s = new ExactMatchCacheStore(() => 1000);
  const policy = enabled();
  s.store({ prompt: "hi" }, { ...OK }, ctx(), policy);
  const got = s.lookup({ prompt: "hi" }, ctx(), policy);
  assert.equal(Object.isFrozen(got.response), true);
  assert.throws(() => { (got.response as { text: string }).text = "x"; }, TypeError);
});

test("lookup is deterministic — equal requests yield equal results", () => {
  const s = new ExactMatchCacheStore(() => 1000);
  const policy = enabled();
  s.store({ prompt: "deterministic" }, OK, ctx(), policy);
  const a = s.lookup({ prompt: "deterministic" }, ctx(), policy);
  const b = s.lookup({ prompt: "deterministic" }, ctx(), policy);
  assert.equal(a.response, b.response);
});

// ── Pipeline independence ───────────────────────────────────────────────────────

test("the pipeline depends only on the CacheManager (a custom store plugs in)", async () => {
  // A bespoke CacheStore the pipeline knows nothing about: serves a hit after the
  // first store, proving new strategies plug in with no pipeline changes.
  let served = 0;
  const custom: CacheStore = {
    name: "custom",
    lookup(): CacheLookupOutcome {
      served += 1;
      return served > 1
        ? { hit: true, response: { ...OK, text: "from-custom-store" }, hitCount: 1, expiredRemoved: false, entryCount: 1, keyDigest: "d" }
        : { hit: false, response: null, hitCount: 0, expiredRemoved: false, entryCount: 1, keyDigest: "d" };
    },
    store(): CacheStoreOutcome { return { stored: true, entryCount: 1, evictedDigests: [], keyDigest: "d" }; },
    remove() { return false; },
    clear() {},
    statistics(): CacheStoreStatistics { return { store: "custom", entryCount: 1, maxEntries: 1, hits: 0, misses: 0, stores: 0, evictions: 0 }; },
  };
  const { reg, calls } = counting();
  const { manager, publisher } = managerWith([custom], enabled());
  const hooks = [manager, publisher];
  const r1 = await executeInference(params(reg, "anything"), hooks); // miss → provider
  const r2 = await executeInference(params(reg, "anything"), hooks); // custom store hit
  assert.equal(r1.response, "hello");
  assert.equal(r2.response, "from-custom-store");
  assert.equal(calls(), 1, "the second request is served by the custom store, not the provider");
});
