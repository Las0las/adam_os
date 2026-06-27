// Prompt Cache Middleware (Milestone 7.0). Exact-match, in-memory caching as
// execution middleware. These tests prove hit/miss, TTL expiry, immutability,
// bypass/disabled no-ops, event publication, middleware ordering, that failures
// are never cached, and — critically — that a cache hit NEVER bypasses the
// security middleware (firewall/validator still run; only the provider is skipped).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionRequest, CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import { registerExecutionHook, listExecutionHooks, clearExecutionHooks } from "@/lib/aiops/execution/execution-hooks";
import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";
import { ExecutionTelemetryEngine } from "@/lib/aiops/execution/observability/telemetry-engine";
import { PromptCache } from "@/lib/aiops/cache/prompt-cache";
import { CacheMetricsCollector } from "@/lib/aiops/cache/cache-metrics";
import { CachePolicyStore, defaultCachePolicy, type CachePolicy } from "@/lib/aiops/cache/cache-types";
import { PromptFirewall } from "@/lib/aiops/security/prompt-firewall";
import { ResponseValidator } from "@/lib/aiops/security/response-validator";
import { SecurityPolicyStore, defaultSecurityPolicy, type SecurityPolicy } from "@/lib/aiops/security/security-types";

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

/** A registry whose provider counts calls. */
function counting(impl: ModelProvider["complete"] = async () => OK) {
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

/** A cache harness over a fresh bus with telemetry + cache metrics. */
function harness(policy: CachePolicy, now: () => number = () => 1000) {
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  const metrics = new CacheMetricsCollector();
  bus.subscribe(telemetry);
  bus.subscribe(metrics);
  const store = new CachePolicyStore(policy);
  const cache = new PromptCache(bus, store, now);
  const publisher = new ExecutionEventPublisher(bus);
  return { bus, telemetry, metrics, store, cache, publisher, hooks: [cache, publisher] };
}

function typesOf(telemetry: ExecutionTelemetryEngine): string[] {
  return telemetry.events().map((e) => e.type);
}

// ── Hit / miss ───────────────────────────────────────────────────────────────

test("an identical prompt hits the cache and skips the provider", async () => {
  const { reg, calls } = counting();
  const h = harness(enabled());
  const r1 = await executeInference(params(reg, "What is the capital of France?"), h.hooks);
  const r2 = await executeInference(params(reg, "What is the capital of France?"), h.hooks);
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  assert.equal(calls(), 1, "the provider is invoked once; the second request is served from cache");
  assert.equal(r2.response, "hello");
  const snap = h.metrics.snapshot();
  assert.equal(snap.hits, 1);
  assert.equal(snap.misses, 1);
  assert.equal(snap.stores, 1);
  assert.equal(snap.hitRate, 0.5);
});

test("a different prompt misses", async () => {
  const { reg, calls } = counting();
  const h = harness(enabled());
  await executeInference(params(reg, "prompt A"), h.hooks);
  await executeInference(params(reg, "prompt B"), h.hooks);
  assert.equal(calls(), 2);
  assert.equal(h.metrics.snapshot().hits, 0);
  assert.equal(h.metrics.snapshot().misses, 2);
});

test("an entry expires after its TTL", async () => {
  const { reg, calls } = counting();
  let clock = 1000;
  const h = harness(enabled({ ttlMs: 5000 }), () => clock);
  await executeInference(params(reg, "ttl prompt"), h.hooks); // store at t=1000, expires 6000
  clock = 3000;
  await executeInference(params(reg, "ttl prompt"), h.hooks); // hit
  assert.equal(calls(), 1);
  clock = 7000;
  await executeInference(params(reg, "ttl prompt"), h.hooks); // expired → miss → provider
  assert.equal(calls(), 2);
  assert.ok(typesOf(h.telemetry).includes("cache.expired"));
  assert.equal(h.metrics.snapshot().evictions, 1);
});

test("a cached execution result is immutable", async () => {
  const { reg } = counting();
  const h = harness(enabled());
  await executeInference(params(reg, "immutable?"), h.hooks);
  const hit = await executeInference(params(reg, "immutable?"), h.hooks);
  assert.equal(Object.isFrozen(hit), true);
  assert.throws(() => { (hit as { response: string | null }).response = "tampered"; }, TypeError);
});

// ── Bypass / disabled ──────────────────────────────────────────────────────────

test("the bypass flag skips the cache entirely", async () => {
  const { reg, calls } = counting();
  const h = harness(enabled({ bypass: true }));
  await executeInference(params(reg, "same"), h.hooks);
  await executeInference(params(reg, "same"), h.hooks);
  assert.equal(calls(), 2, "bypass forces a fresh provider call every time");
  assert.equal(h.metrics.snapshot().hits, 0);
  assert.equal(h.metrics.snapshot().stores, 0);
  assert.deepEqual(typesOf(h.telemetry).filter((t) => t.startsWith("cache.")), []);
});

test("a disabled policy is a complete no-op", async () => {
  const { reg, calls } = counting();
  const h = harness(defaultCachePolicy()); // disabled
  await executeInference(params(reg, "same"), h.hooks);
  await executeInference(params(reg, "same"), h.hooks);
  assert.equal(calls(), 2);
  assert.deepEqual(typesOf(h.telemetry).filter((t) => t.startsWith("cache.")), []);
});

test("only cacheable workloads are cached", async () => {
  const { reg, calls } = counting();
  const h = harness(enabled({ cacheableWorkloads: ["embedding"] })); // not "chat"
  await executeInference(params(reg, "same"), h.hooks);
  await executeInference(params(reg, "same"), h.hooks);
  assert.equal(calls(), 2);
});

// ── Events ─────────────────────────────────────────────────────────────────────

test("cache events are published for miss, store, and hit", async () => {
  const { reg } = counting();
  const h = harness(enabled());
  await executeInference(params(reg, "events"), h.hooks);
  await executeInference(params(reg, "events"), h.hooks);
  const types = typesOf(h.telemetry);
  assert.ok(types.includes("cache.miss"));
  assert.ok(types.includes("cache.store"));
  assert.ok(types.includes("cache.hit"));
});

// ── Failures are never cached ──────────────────────────────────────────────────

test("provider failures are not cached", async () => {
  const { reg, calls } = counting(async () => { throw new Error("boom"); });
  const h = harness(enabled());
  const r1 = await executeInference(params(reg, "fails"), h.hooks);
  const r2 = await executeInference(params(reg, "fails"), h.hooks);
  assert.equal(r1.success, false);
  assert.equal(r2.success, false);
  assert.equal(calls(), 2, "a failed execution is retried, never served from cache");
  assert.equal(h.metrics.snapshot().stores, 0);
});

// ── Middleware ordering ─────────────────────────────────────────────────────────

test("the cache registers first in the middleware chain", () => {
  clearExecutionHooks();
  const bus = new ExecutionEventBus();
  const store = new CachePolicyStore(enabled());
  const cache = new PromptCache(bus, store);
  const secStore = new SecurityPolicyStore(defaultSecurityPolicy());
  const firewall = new PromptFirewall(bus, secStore);
  const validator = new ResponseValidator(bus, secStore);
  const publisher = new ExecutionEventPublisher(bus);
  // Register out of order; the registry must sort by priority.
  registerExecutionHook(publisher);
  registerExecutionHook(validator);
  registerExecutionHook(cache);
  registerExecutionHook(firewall);
  try {
    assert.deepEqual(listExecutionHooks().map((m) => m.name),
      ["prompt-cache", "prompt-firewall", "response-validator", "event-bus"]);
  } finally {
    clearExecutionHooks();
  }
});

// ── Never bypass security ──────────────────────────────────────────────────────

function secPolicy(overrides: Partial<SecurityPolicy> = {}): SecurityPolicy {
  const base = defaultSecurityPolicy();
  return { ...base, ...overrides, firewall: { ...base.firewall, ...(overrides.firewall ?? {}) } };
}

test("a cache hit still runs the firewall and validator (security is not bypassed)", async () => {
  const { reg, calls } = counting();
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  bus.subscribe(telemetry);
  const cacheStore = new CachePolicyStore(enabled());
  const cache = new PromptCache(bus, cacheStore);
  const secStore = new SecurityPolicyStore(defaultSecurityPolicy());
  const firewall = new PromptFirewall(bus, secStore);
  const validator = new ResponseValidator(bus, secStore);
  const publisher = new ExecutionEventPublisher(bus);
  const hooks = [cache, firewall, validator, publisher];

  await executeInference(params(reg, "a benign question"), hooks); // miss → store
  const types = typesOf(telemetry);
  telemetry.reset();
  const hit = await executeInference(params(reg, "a benign question"), hooks); // hit

  assert.equal(calls(), 1, "provider skipped on the hit");
  assert.equal(hit.success, true);
  const hitTypes = typesOf(telemetry);
  assert.ok(hitTypes.includes("cache.hit"));
  assert.ok(hitTypes.includes("security.prompt_inspected"), "firewall still inspects on a hit");
  assert.ok(hitTypes.includes("security.validation_succeeded"), "validator still runs on a hit");
  assert.ok(types.length > 0);
});

test("a cache hit cannot bypass a firewall block introduced after caching", async () => {
  const { reg, calls } = counting();
  const bus = new ExecutionEventBus();
  const cacheStore = new CachePolicyStore(enabled());
  const cache = new PromptCache(bus, cacheStore);
  const secStore = new SecurityPolicyStore(secPolicy());
  const firewall = new PromptFirewall(bus, secStore);
  const publisher = new ExecutionEventPublisher(bus);
  const hooks = [cache, firewall, publisher];

  await executeInference(params(reg, "the SECRET project status"), hooks); // cached (firewall allows)
  assert.equal(calls(), 1);

  // Now the firewall is reconfigured to block this content.
  secStore.configure(secPolicy({ firewall: { mode: "enforce", allowList: [], denyList: ["SECRET"] } }));
  const blocked = await executeInference(params(reg, "the SECRET project status"), hooks);
  assert.equal(blocked.success, false);
  assert.equal(blocked.error?.kind, "security_violation");
  assert.equal(calls(), 1, "the provider is never called; the firewall blocks the request despite a cache hit");
});
