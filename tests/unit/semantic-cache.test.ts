// IOS-009 — Semantic Cache (per AS-001). The SemanticCacheStore is an additional
// CacheStore registered through the Cache Platform; the CacheManager, Execution
// Pipeline, and PromptCache are unmodified. These tests prove: registration,
// similarity hits within a compatibility group, fall-through on dissimilarity,
// compatibility isolation, the confidence threshold, exact-before-semantic
// ordering, semantic events + metrics, and the disabled no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";
import { ExecutionTelemetryEngine } from "@/lib/aiops/execution/observability/telemetry-engine";
import { CacheManager } from "@/lib/aiops/cache/cache-manager";
import { CacheRegistry } from "@/lib/aiops/cache/cache-registry";
import { ExactMatchCacheStore } from "@/lib/aiops/cache/exact-match-cache-store";
import { CachePolicyStore, defaultCachePolicy } from "@/lib/aiops/cache/cache-types";
import { SemanticCacheStore } from "@/lib/aiops/cache/semantic-cache-store";
import { SimilarityPolicyStore } from "@/lib/aiops/cache/semantic-types";
import { SemanticCacheMetricsCollector } from "@/lib/aiops/cache/semantic-metrics";
import type { Embedder } from "@/lib/aiops/cache/semantic-embedder";

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
const echo: ModelProvider["complete"] = async (req) => ({ ...OK, text: `r:${req.prompt}` });
function counting(impl: ModelProvider["complete"] = echo) {
  let n = 0;
  const reg = registryWith(async (req) => { n += 1; return impl(req); });
  return { reg, calls: () => n };
}
function decision(): RoutingDecision {
  return { selectedProvider: "p", selectedModel: "m", evaluatedProviders: ["p"], rejectionReasons: [], policySnapshot: {} };
}
function params(registry: ProviderRegistry, prompt: string, workloadType = "chat") {
  return { request: { prompt }, routingDecision: decision(), registry, requestId: "req", tenantId: "tnt", workloadType };
}

/** Controlled embedder: maps a marker token to a fixed unit vector so cosine
 *  similarities are exact and deterministic. */
const markerEmbedder: Embedder = {
  name: "marker",
  dimension: 3,
  embed(text) {
    if (text.includes("CAR")) return [1, 0, 0];
    if (text.includes("AUTO")) return [0.96, 0.28, 0]; // cos with CAR ≈ 0.96
    if (text.includes("FOOD")) return [0, 1, 0];        // cos with CAR = 0
    return [0, 0, 1];
  },
};

/** Wired cache manager with exact + semantic stores over a fresh bus. */
function harness(opts: { threshold?: number; semanticEnabled?: boolean } = {}) {
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  const semMetrics = new SemanticCacheMetricsCollector();
  bus.subscribe(telemetry);
  bus.subscribe(semMetrics);
  const registry = new CacheRegistry();
  registry.register(new ExactMatchCacheStore());
  const simStore = new SimilarityPolicyStore({ enabled: opts.semanticEnabled ?? true, threshold: opts.threshold ?? 0.9 });
  const semantic = new SemanticCacheStore(bus, simStore, markerEmbedder);
  registry.register(semantic);
  const policyStore = new CachePolicyStore({ ...defaultCachePolicy(), mode: "enabled" });
  const manager = new CacheManager({ bus, policyStore, registry });
  const publisher = new ExecutionEventPublisher(bus);
  return { bus, telemetry, semMetrics, registry, simStore, semantic, manager, publisher, hooks: [manager, publisher] };
}

function typesOf(t: ExecutionTelemetryEngine): string[] {
  return t.events().map((e) => e.type);
}

// ── Registration ──────────────────────────────────────────────────────────────

test("the semantic store registers through the CacheRegistry after exact-match", () => {
  const reg = new CacheRegistry();
  reg.register(new ExactMatchCacheStore());
  reg.register(new SemanticCacheStore(new ExecutionEventBus(), new SimilarityPolicyStore()));
  assert.deepEqual(reg.list().map((s) => s.name), ["exact-match", "semantic"]);
});

// ── Similarity hit ──────────────────────────────────────────────────────────────

test("a semantically similar request hits without invoking the provider", async () => {
  const { reg, calls } = counting();
  const h = harness({ threshold: 0.9 });
  const r1 = await executeInference(params(reg, "tell me about my CAR"), h.hooks); // miss → provider → stored
  const r2 = await executeInference(params(reg, "tell me about my AUTO"), h.hooks); // semantic hit
  assert.equal(calls(), 1, "the similar request is served from the semantic cache");
  assert.equal(r2.response, "r:tell me about my CAR", "returns the cached (matched) response");
  assert.ok(typesOf(h.telemetry).includes("semantic.hit"));
  assert.equal(h.semMetrics.snapshot().hits, 1);
  assert.ok(h.semMetrics.snapshot().averageHitSimilarity >= 0.9);
});

test("a dissimilar request misses and falls through to the provider", async () => {
  const { reg, calls } = counting();
  const h = harness({ threshold: 0.9 });
  await executeInference(params(reg, "about my CAR"), h.hooks);   // store
  const r = await executeInference(params(reg, "about my FOOD"), h.hooks); // dissimilar → provider
  assert.equal(calls(), 2);
  assert.equal(r.response, "r:about my FOOD");
  assert.ok(typesOf(h.telemetry).includes("semantic.miss"));
});

// ── Compatibility isolation ─────────────────────────────────────────────────────

test("requests in different compatibility groups do not semantically match", async () => {
  const { reg, calls } = counting();
  const h = harness({ threshold: 0.9 });
  await executeInference(params(reg, "my CAR", "chat"), h.hooks);        // stored under workload "chat"
  const r = await executeInference(params(reg, "my AUTO", "embedding"), h.hooks); // different workload
  assert.equal(calls(), 2, "different workload → different compatibility group → no semantic reuse");
  assert.equal(r.response, "r:my AUTO");
});

// ── Confidence threshold ────────────────────────────────────────────────────────

test("the confidence threshold is respected", async () => {
  const { reg, calls } = counting();
  const h = harness({ threshold: 0.99 }); // 0.96 similarity is below 0.99
  await executeInference(params(reg, "my CAR"), h.hooks);
  const r = await executeInference(params(reg, "my AUTO"), h.hooks);
  assert.equal(calls(), 2, "similarity 0.96 < threshold 0.99 → miss");
  assert.equal(r.response, "r:my AUTO");
});

// ── Exact-before-semantic ───────────────────────────────────────────────────────

test("an exact repeat hits the exact store and never consults the semantic store", async () => {
  const { reg, calls } = counting();
  const h = harness({ threshold: 0.9 });
  await executeInference(params(reg, "my CAR"), h.hooks);
  h.telemetry.reset();
  const r = await executeInference(params(reg, "my CAR"), h.hooks); // identical → exact hit
  assert.equal(calls(), 1);
  assert.equal(r.response, "r:my CAR");
  const types = typesOf(h.telemetry);
  assert.ok(types.includes("cache.hit"));
  assert.deepEqual(types.filter((t) => t.startsWith("semantic.")), [], "exact hit short-circuits before semantic");
});

// ── Events / disabled ───────────────────────────────────────────────────────────

test("the semantic store publishes stored + hit/miss events", async () => {
  const { reg } = counting();
  const h = harness({ threshold: 0.9 });
  await executeInference(params(reg, "my CAR"), h.hooks);   // miss then stored
  await executeInference(params(reg, "my AUTO"), h.hooks);  // hit
  const types = typesOf(h.telemetry);
  assert.ok(types.includes("semantic.stored"));
  assert.ok(types.includes("semantic.miss"));
  assert.ok(types.includes("semantic.hit"));
});

test("a disabled similarity policy makes the semantic store inert", async () => {
  const { reg, calls } = counting();
  const h = harness({ semanticEnabled: false, threshold: 0.9 });
  await executeInference(params(reg, "my CAR"), h.hooks);
  const r = await executeInference(params(reg, "my AUTO"), h.hooks);
  assert.equal(calls(), 2, "semantic disabled → similar request still goes to the provider");
  assert.equal(r.response, "r:my AUTO");
  assert.deepEqual(typesOf(h.telemetry).filter((t) => t === "semantic.hit"), []);
});
