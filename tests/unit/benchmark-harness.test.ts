// IOS-014 — Benchmark Harness (per AS-001). The harness drives benchmark cases
// THROUGH the public execution API (IOS-004 executeInference, via IOS-003 routing)
// — it never invokes providers directly or influences production routing. These
// tests prove: suite registration, case execution through the pipeline, a
// successful run, a failed case, deterministic scoring, event publication, metrics,
// immutable results, routing-pinned eligibility, retry-disable, and disabled no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";
import { ExecutionTelemetryEngine } from "@/lib/aiops/execution/observability/telemetry-engine";
import { RetryMiddleware } from "@/lib/aiops/retry/retry-middleware";
import { RetryPolicyStore, defaultRetryPolicy } from "@/lib/aiops/retry/retry-types";
import { BenchmarkHarness } from "@/lib/aiops/benchmark/benchmark-harness";
import { BenchmarkResultStore } from "@/lib/aiops/benchmark/benchmark-store";
import { BenchmarkMetricsCollector } from "@/lib/aiops/benchmark/benchmark-metrics";
import { BenchmarkPolicyStore, defaultBenchmarkPolicy, type BenchmarkPolicy, type BenchmarkSuite } from "@/lib/aiops/benchmark/benchmark-types";

const OK: CompletionResponse = {
  text: "hello", json: null, promptTokens: 5, completionTokens: 3,
  latencyMs: 1, costUsd: 0.01, provider: "p", modelKey: "m",
};
function descriptor(provider: string, model: string): ModelDescriptor {
  return {
    provider, publisher: "acme", family: "fam", model, version: null,
    contextWindow: 128_000, supportsVision: false, supportsTools: false,
    supportsStreaming: false, supportsJSON: true, supportsReasoning: false,
    supportsEmbeddings: false, pricing: null, deprecated: false,
  };
}
interface Spec { id: string; model: string; complete: ModelProvider["complete"] }
function multiRegistry(specs: Spec[]): { reg: ProviderRegistry; calls: Record<string, number> } {
  const reg = createProviderRegistry();
  const calls: Record<string, number> = {};
  for (const s of specs) {
    calls[s.id] = 0;
    const adapter: ModelProvider = {
      provider: s.id, modelKey: s.model,
      complete: async (req) => { calls[s.id] = (calls[s.id] ?? 0) + 1; return s.complete(req); },
    };
    reg.register(defineProvider({
      metadata: { id: s.id, vendor: s.id, displayName: s.id, authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
      descriptors: [descriptor(s.id, s.model)], requiredEnv: [], defaultPriority: 10,
      create: () => adapter, createDefault: () => adapter,
    }));
  }
  return reg2(reg, calls);
}
function reg2(reg: ProviderRegistry, calls: Record<string, number>) { return { reg, calls }; }
const echo = (tag: string): ModelProvider["complete"] => async (req) => ({ ...OK, text: `${tag}:${req.prompt}` });
const fails = (msg: string): ModelProvider["complete"] => async () => { throw new Error(msg); };

function suite(over: Partial<BenchmarkSuite> = {}): BenchmarkSuite {
  return {
    suiteId: "suite-1", name: "Demo Suite", workloadType: "chat",
    cases: [
      { caseId: "c1", inputMessages: [{ role: "user", content: "hi" }], scoringMetadata: { expected: "hi" } },
      { caseId: "c2", inputMessages: [{ role: "user", content: "bye" }], scoringMetadata: { expected: "bye" } },
    ],
    eligibleProviders: ["p1"], eligibleModels: ["m1"], scoringStrategy: "success", timeoutMs: 1000,
    ...over,
  };
}
function enabled(over: Partial<BenchmarkPolicy> = {}): BenchmarkPolicy {
  return { ...defaultBenchmarkPolicy(), mode: "enabled", ...over };
}

function harness(policy: BenchmarkPolicy, extraHooks: "retry"[] = []) {
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  const metrics = new BenchmarkMetricsCollector();
  bus.subscribe(telemetry);
  bus.subscribe(metrics);
  const store = new BenchmarkResultStore();
  let runSeq = 0;
  const h = new BenchmarkHarness(bus, store, new BenchmarkPolicyStore(policy), { now: () => 0, newRunId: () => `run-${++runSeq}` });
  const hooks = [
    new ExecutionEventPublisher(bus),
    ...(extraHooks.includes("retry") ? [new RetryMiddleware(bus, new RetryPolicyStore({ ...defaultRetryPolicy(), mode: "enabled", maxAttempts: 3, initialDelayMs: 1, backoff: "fixed" }), { sleep: async () => {} })] : []),
  ];
  return { bus, telemetry, metrics, store, h, hooks };
}
function types(t: ExecutionTelemetryEngine): string[] { return t.events().map((e) => e.type); }

// ── Suite registration ────────────────────────────────────────────────────────

test("a registered suite is stored immutably and listable", () => {
  const { h, store } = harness(enabled());
  const s = h.register(suite());
  assert.equal(Object.isFrozen(s), true);
  assert.equal(store.getSuite("suite-1")!.name, "Demo Suite");
  assert.equal(store.allSuites().length, 1);
});

// ── Successful run through the pipeline ───────────────────────────────────────

test("a suite runs through the public pipeline and records results", async () => {
  const { reg, calls } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
  const h = harness(enabled());
  const runs = await h.h.runSuite(suite(), { registry: reg, hooks: h.hooks });
  assert.equal(runs.length, 1);
  const run = runs[0]!;
  assert.equal(run.status, "completed");
  assert.equal(run.provider, "p1");
  assert.equal(run.results.length, 2);
  assert.ok(run.results.every((r) => r.success && r.normalizedScore === 1));
  // The provider was reached ONLY via the pipeline (executeInference) — two cases.
  assert.equal(calls.p1, 2);
  assert.ok(types(h.telemetry).includes("execution.completed"), "execution flowed through the pipeline");
  // Token usage + health reference captured.
  assert.deepEqual(run.results[0]!.tokenUsage, { prompt: 5, completion: 3, total: 8 });
  assert.equal(run.results[0]!.healthSnapshotRef, "p1|m1");
});

// ── Deterministic scoring ─────────────────────────────────────────────────────

test("scoring is deterministic across runs", async () => {
  const mk = async () => {
    const { reg } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
    const h = harness(enabled({}));
    const runs = await h.h.runSuite(suite({ scoringStrategy: "contains" }), { registry: reg, hooks: h.hooks });
    return runs[0]!.results.map((r) => r.normalizedScore);
  };
  assert.deepEqual(await mk(), await mk());
});

test("contains scoring matches the expected substring deterministically", async () => {
  const { reg } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
  const h = harness(enabled());
  // echo returns "p1:user: hi" — contains "hi"; case c2 contains "bye".
  const runs = await h.h.runSuite(suite({ scoringStrategy: "contains" }), { registry: reg, hooks: h.hooks });
  assert.ok(runs[0]!.results.every((r) => r.normalizedScore === 1));
});

// ── Failed case ──────────────────────────────────────────────────────────────

test("a provider failure yields a failed case with score 0", async () => {
  const { reg } = multiRegistry([{ id: "p1", model: "m1", complete: fails("503 unavailable") }]);
  const h = harness(enabled());
  const runs = await h.h.runSuite(suite(), { registry: reg, hooks: h.hooks });
  const run = runs[0]!;
  assert.equal(run.status, "completed");
  assert.ok(run.results.every((r) => !r.success && r.executionOutcome === "failure" && r.normalizedScore === 0));
  assert.ok(run.results[0]!.validationErrors.length > 0);
  assert.ok(types(h.telemetry).includes("benchmark.case_failed"));
});

// ── Event publication ────────────────────────────────────────────────────────

test("a run publishes the full benchmark event sequence", async () => {
  const { reg } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
  const h = harness(enabled());
  await h.h.runSuite(suite(), { registry: reg, hooks: h.hooks });
  const t = types(h.telemetry);
  assert.ok(t.includes("benchmark.run_started"));
  assert.ok(t.includes("benchmark.case_started"));
  assert.ok(t.includes("benchmark.case_completed"));
  assert.ok(t.includes("benchmark.run_completed"));
});

// ── Metrics ──────────────────────────────────────────────────────────────────

test("metrics fold benchmark events into counters and scores", async () => {
  const { reg } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
  const h = harness(enabled());
  await h.h.runSuite(suite(), { registry: reg, hooks: h.hooks });
  const m = h.metrics.snapshot();
  assert.equal(m.casesExecuted, 2);
  assert.equal(m.successes, 2);
  assert.equal(m.successRate, 1);
  assert.equal(m.providerScore.p1, 1);
  assert.equal(m.modelScore.m1, 1);
});

// ── Immutable results ────────────────────────────────────────────────────────

test("runs and results are immutable", async () => {
  const { reg } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
  const h = harness(enabled());
  const runs = await h.h.runSuite(suite(), { registry: reg, hooks: h.hooks });
  const run = runs[0]!;
  assert.equal(Object.isFrozen(run), true);
  assert.equal(Object.isFrozen(run.results), true);
  assert.equal(Object.isFrozen(run.results[0]), true);
  assert.throws(() => { (run as { status: string }).status = "failed"; }, TypeError);
});

// ── Routing-pinned eligibility ───────────────────────────────────────────────

test("a target routing does not select is recorded as not_eligible (no provider call)", async () => {
  const { reg, calls } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
  const h = harness(enabled());
  // The suite asks for p_absent which is not registered → routing selects nothing.
  const runs = await h.h.runSuite(suite({ eligibleProviders: ["p_absent"], eligibleModels: ["m1"] }), { registry: reg, hooks: h.hooks });
  const run = runs[0]!;
  assert.ok(run.results.every((r) => r.executionOutcome === "not_eligible" && !r.success));
  assert.equal(calls.p1, 0, "no provider is invoked for an unrouted target");
});

// ── Retry disable (policy filters the hook) ──────────────────────────────────

test("disableRetry drops the retry middleware so a failure is not retried", async () => {
  const { reg, calls } = multiRegistry([{ id: "p1", model: "m1", complete: fails("timed out") }]);
  const h = harness(enabled({ disableRetry: true }), ["retry"]);
  await h.h.runSuite(suite({ cases: [{ caseId: "c1", inputMessages: [{ role: "user", content: "hi" }] }] }), { registry: reg, hooks: h.hooks });
  assert.equal(calls.p1, 1, "retry was disabled for the benchmark → exactly one provider call");
  assert.deepEqual(types(h.telemetry).filter((x) => x.startsWith("retry.")), [], "retry middleware did not run");
});

test("with retry enabled, a transient failure is retried and reflected in retryCount", async () => {
  let n = 0;
  const reg = createProviderRegistry();
  const adapter: ModelProvider = { provider: "p1", modelKey: "m1", complete: async (req) => { n += 1; if (n < 2) throw new Error("timed out"); return { ...OK, text: `p1:${req.prompt}` }; } };
  reg.register(defineProvider({
    metadata: { id: "p1", vendor: "p1", displayName: "p1", authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
    descriptors: [descriptor("p1", "m1")], requiredEnv: [], defaultPriority: 10, create: () => adapter, createDefault: () => adapter,
  }));
  const h = harness(enabled(), ["retry"]);
  const runs = await h.h.runSuite(suite({ cases: [{ caseId: "c1", inputMessages: [{ role: "user", content: "hi" }] }] }), { registry: reg, hooks: h.hooks });
  const r = runs[0]!.results[0]!;
  assert.equal(r.success, true);
  assert.ok(r.retryCount >= 1, "retry attempts were correlated from the bus");
});

// ── Disabled no-op ───────────────────────────────────────────────────────────

test("a disabled policy is a no-op (no runs)", async () => {
  const { reg, calls } = multiRegistry([{ id: "p1", model: "m1", complete: echo("p1") }]);
  const h = harness(defaultBenchmarkPolicy()); // disabled
  const runs = await h.h.runSuite(suite(), { registry: reg, hooks: h.hooks });
  assert.deepEqual(runs, []);
  assert.equal(calls.p1, 0);
});
