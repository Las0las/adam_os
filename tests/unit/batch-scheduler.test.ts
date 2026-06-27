// IOS-008 — Batch Scheduler (per AS-001). The scheduler groups compatible
// requests into deterministic batches as execution middleware, holding each
// request (after the cache, before security) until its batch dispatches, then
// letting it proceed through firewall → PII → provider → validator. These tests
// prove batching, isolation, size/timeout dispatch, bypass/disabled no-ops,
// events, metrics, ordering, deterministic response mapping, and that security +
// validation still run for every batched request.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import { registerExecutionHook, listExecutionHooks, clearExecutionHooks } from "@/lib/aiops/execution/execution-hooks";
import { ExecutionEventBus, type BusEvent } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";
import { ExecutionTelemetryEngine } from "@/lib/aiops/execution/observability/telemetry-engine";
import { BatchScheduler, type BatchSchedulerDeps } from "@/lib/aiops/batch/batch-scheduler";
import { BatchMetricsCollector } from "@/lib/aiops/batch/batch-metrics";
import { BatchPolicyStore, defaultBatchPolicy, type BatchPolicy } from "@/lib/aiops/batch/batch-types";
// For ordering + security-interaction tests:
import { PromptCache } from "@/lib/aiops/cache/prompt-cache";
import { CachePolicyStore, defaultCachePolicy } from "@/lib/aiops/cache/cache-types";
import { PromptFirewall } from "@/lib/aiops/security/prompt-firewall";
import { ResponseValidator } from "@/lib/aiops/security/response-validator";
import { SecurityPolicyStore, defaultSecurityPolicy } from "@/lib/aiops/security/security-types";

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

function enabledBatch(overrides: Partial<BatchPolicy> = {}): BatchPolicy {
  return { ...defaultBatchPolicy(), mode: "enabled", ...overrides };
}

/** A controllable timer: captures scheduled callbacks for manual firing. */
function fakeTimer() {
  const fns: Array<() => void> = [];
  const deps: BatchSchedulerDeps = {
    setTimer: (fn) => { fns.push(fn); return fns.length; },
    clearTimer: () => {},
  };
  return { deps, fireAll: () => { const due = fns.splice(0); for (const f of due) f(); } };
}

/** A wired batch harness over a fresh bus with telemetry + batch metrics. */
function harness(policy: BatchPolicy, deps: BatchSchedulerDeps = {}) {
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  const metrics = new BatchMetricsCollector();
  bus.subscribe(telemetry);
  bus.subscribe(metrics);
  const store = new BatchPolicyStore(policy);
  const scheduler = new BatchScheduler(bus, store, deps);
  const publisher = new ExecutionEventPublisher(bus);
  return { bus, telemetry, metrics, store, scheduler, publisher, hooks: [scheduler, publisher] };
}

function typesOf(t: ExecutionTelemetryEngine): string[] {
  return t.events().map((e) => e.type);
}
function batchEvents(t: ExecutionTelemetryEngine, type: string): BusEvent[] {
  return t.events().filter((e) => e.type === type);
}
async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw new Error("condition not met in time");
}

// ── Disabled / single ───────────────────────────────────────────────────────

test("a disabled policy is a complete no-op", async () => {
  const { reg, calls } = counting();
  const h = harness(defaultBatchPolicy()); // disabled
  const res = await executeInference(params(reg, "hi"), h.hooks);
  assert.equal(res.success, true);
  assert.equal(calls(), 1);
  assert.deepEqual(typesOf(h.telemetry).filter((x) => x.startsWith("batch.")), []);
});

test("a single request dispatches immediately at maxBatchSize 1", async () => {
  const { reg, calls } = counting();
  const h = harness(enabledBatch({ maxBatchSize: 1 }));
  const res = await executeInference(params(reg, "solo"), h.hooks);
  assert.equal(res.success, true);
  assert.equal(res.response, "r:solo");
  assert.equal(calls(), 1);
  assert.equal(h.metrics.snapshot().batchesDispatched, 1);
  assert.equal(h.metrics.snapshot().requestsBatched, 1);
});

// ── Compatible batching ──────────────────────────────────────────────────────

test("compatible requests are grouped into one batch (size-triggered)", async () => {
  const { reg, calls } = counting();
  const h = harness(enabledBatch({ maxBatchSize: 2 }), fakeTimer().deps);
  const p1 = executeInference(params(reg, "A"), h.hooks);
  const p2 = executeInference(params(reg, "B"), h.hooks);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  assert.equal(calls(), 2, "each request still calls the provider (single-request abstraction)");
  const snap = h.metrics.snapshot();
  assert.equal(snap.batchesCreated, 1);
  assert.equal(snap.requestsBatched, 2);
  assert.equal(snap.averageBatchSize, 2);
  const dispatched = batchEvents(h.telemetry, "batch.dispatched");
  assert.equal(dispatched.length, 1);
});

test("deterministic response mapping: each batched request gets its own response", async () => {
  const { reg } = counting();
  const h = harness(enabledBatch({ maxBatchSize: 3 }), fakeTimer().deps);
  const ps = ["alpha", "beta", "gamma"].map((x) => executeInference(params(reg, x), h.hooks));
  const results = await Promise.all(ps);
  assert.equal(results[0]?.response, "r:alpha");
  assert.equal(results[1]?.response, "r:beta");
  assert.equal(results[2]?.response, "r:gamma");
});

test("maxBatchSize bounds each batch", async () => {
  const { reg, calls } = counting();
  const h = harness(enabledBatch({ maxBatchSize: 2 }), fakeTimer().deps);
  const ps = ["a", "b", "c", "d"].map((x) => executeInference(params(reg, x), h.hooks));
  await Promise.all(ps);
  assert.equal(calls(), 4);
  const snap = h.metrics.snapshot();
  assert.equal(snap.batchesDispatched, 2, "four requests, cap 2 → two size-triggered batches");
  assert.equal(snap.averageBatchSize, 2);
});

// ── Incompatible isolation ───────────────────────────────────────────────────

test("incompatible requests form separate batches", async () => {
  const { reg } = counting();
  const ft = fakeTimer();
  const h = harness(enabledBatch({ maxBatchSize: 5, maxWaitMs: 50 }), ft.deps);
  const pa = executeInference(params(reg, "x", "chat"), h.hooks);
  const pb = executeInference(params(reg, "y", "embedding"), h.hooks); // different workload → different key
  await until(() => h.scheduler.pending() === 2);
  ft.fireAll(); // both groups time out and dispatch separately
  const [ra, rb] = await Promise.all([pa, pb]);
  assert.equal(ra.response, "r:x");
  assert.equal(rb.response, "r:y");
  assert.equal(h.metrics.snapshot().batchesCreated, 2);
});

// ── Timeout ──────────────────────────────────────────────────────────────────

test("a batch dispatches on timeout when the size bound is not reached", async () => {
  const { reg, calls } = counting();
  const ft = fakeTimer();
  const h = harness(enabledBatch({ maxBatchSize: 10, maxWaitMs: 50 }), ft.deps);
  const p1 = executeInference(params(reg, "lonely"), h.hooks);
  await until(() => h.scheduler.pending() === 1);
  assert.equal(calls(), 0, "request is held before timeout");
  ft.fireAll();
  const r1 = await p1;
  assert.equal(r1.response, "r:lonely");
  assert.equal(calls(), 1);
  assert.equal(h.metrics.snapshot().batchesExpired, 1);
  assert.ok(typesOf(h.telemetry).includes("batch.expired"));
});

// ── Bypass ───────────────────────────────────────────────────────────────────

test("the bypass flag dispatches immediately and records a bypass", async () => {
  const { reg, calls } = counting();
  const h = harness(enabledBatch({ bypass: true }));
  const res = await executeInference(params(reg, "hi"), h.hooks);
  assert.equal(res.success, true);
  assert.equal(calls(), 1);
  assert.ok(typesOf(h.telemetry).includes("batch.bypassed"));
  assert.equal(h.metrics.snapshot().requestsBypassed, 1);
});

// ── Events ───────────────────────────────────────────────────────────────────

test("a size-triggered batch publishes created → queued → dispatched → completed", async () => {
  const { reg } = counting();
  const h = harness(enabledBatch({ maxBatchSize: 2 }), fakeTimer().deps);
  await Promise.all([executeInference(params(reg, "A"), h.hooks), executeInference(params(reg, "B"), h.hooks)]);
  const types = typesOf(h.telemetry);
  assert.ok(types.includes("batch.created"));
  assert.equal(batchEvents(h.telemetry, "batch.queued").length, 2);
  assert.ok(types.includes("batch.dispatched"));
  assert.ok(types.includes("batch.completed"));
});

// ── Middleware ordering ──────────────────────────────────────────────────────

test("the batch scheduler orders after the cache and before security", () => {
  clearExecutionHooks();
  const bus = new ExecutionEventBus();
  const cache = new PromptCache(bus, new CachePolicyStore(defaultCachePolicy()));
  const batch = new BatchScheduler(bus, new BatchPolicyStore(defaultBatchPolicy()));
  const secStore = new SecurityPolicyStore(defaultSecurityPolicy());
  const firewall = new PromptFirewall(bus, secStore);
  const validator = new ResponseValidator(bus, secStore);
  const publisher = new ExecutionEventPublisher(bus);
  registerExecutionHook(publisher);
  registerExecutionHook(validator);
  registerExecutionHook(firewall);
  registerExecutionHook(batch);
  registerExecutionHook(cache);
  try {
    assert.deepEqual(listExecutionHooks().map((m) => m.name),
      ["prompt-cache", "batch-scheduler", "prompt-firewall", "response-validator", "event-bus"]);
  } finally {
    clearExecutionHooks();
  }
});

// ── Security preserved for batched requests ──────────────────────────────────

test("security and validation still run for every batched request", async () => {
  const { reg } = counting();
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  bus.subscribe(telemetry);
  const batch = new BatchScheduler(bus, new BatchPolicyStore(enabledBatch({ maxBatchSize: 2 })), fakeTimer().deps);
  const secStore = new SecurityPolicyStore(defaultSecurityPolicy());
  const firewall = new PromptFirewall(bus, secStore);
  const validator = new ResponseValidator(bus, secStore);
  const publisher = new ExecutionEventPublisher(bus);
  const hooks = [batch, firewall, validator, publisher];
  await Promise.all([
    executeInference(params(reg, "a benign question"), hooks),
    executeInference(params(reg, "another benign question"), hooks),
  ]);
  const types = telemetry.events().map((e) => e.type);
  assert.equal(types.filter((t) => t === "security.prompt_inspected").length, 2, "firewall runs per batched request");
  assert.equal(types.filter((t) => t === "security.validation_succeeded").length, 2, "validator runs per batched request");
  assert.ok(types.includes("batch.dispatched"));
});

// ── Cache interaction ────────────────────────────────────────────────────────

test("a cache hit is never batched (cache short-circuits before the scheduler)", async () => {
  const { reg, calls } = counting();
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  bus.subscribe(telemetry);
  const cache = new PromptCache(bus, new CachePolicyStore({ ...defaultCachePolicy(), mode: "enabled" }));
  const batch = new BatchScheduler(bus, new BatchPolicyStore(enabledBatch({ maxBatchSize: 1 })), fakeTimer().deps);
  const publisher = new ExecutionEventPublisher(bus);
  const hooks = [cache, batch, publisher];
  await executeInference(params(reg, "same"), hooks); // miss → batched (size 1) → provider → cached
  telemetry.reset();
  const hit = await executeInference(params(reg, "same"), hooks); // cache hit
  assert.equal(hit.success, true);
  assert.equal(calls(), 1, "second request served from cache, not the provider");
  assert.ok(typesOf(telemetry).includes("cache.hit"));
  assert.deepEqual(typesOf(telemetry).filter((t) => t.startsWith("batch.")), [], "the cache hit never reaches the batch scheduler");
});
