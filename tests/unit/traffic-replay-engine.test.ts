// IOS-016 — Traffic Replay Engine (per AS-001). Replays recorded inputs THROUGH
// the public execution API (IOS-004 executeInference, via IOS-003 routing) on an
// ISOLATED replay bus — never invoking providers directly, never mutating
// historical events / RoutingDecision / ExecutionPlan / health, never altering
// production routing. These tests prove: record registration, replay through the
// pipeline, replay marking, isolation (production health + production metrics are
// never contaminated), replay-scoped explainability, routing-pinned eligibility,
// immutable results, and the disabled no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExplanationStore } from "@/lib/aiops/explainability/explanation-store";
import { ExplainabilityEngine } from "@/lib/aiops/explainability/explainability-engine";
import { ExplainabilityPolicyStore, defaultExplainabilityPolicy } from "@/lib/aiops/explainability/explainability-types";
import { ProviderHealthManager } from "@/lib/aiops/health/health-manager";
import { ProviderHealthStore } from "@/lib/aiops/health/health-store";
import { HealthPolicyStore, defaultHealthPolicy } from "@/lib/aiops/health/health-types";
import { TrafficReplayEngine } from "@/lib/aiops/replay/replay-engine";
import { ReplayStore } from "@/lib/aiops/replay/replay-store";
import { ReplayMetricsCollector } from "@/lib/aiops/replay/replay-metrics";
import { ReplayPolicyStore, defaultReplayPolicy, REPLAY_TENANT, type ReplayPolicy, type ReplayRecord } from "@/lib/aiops/replay/replay-types";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";

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
function registry(complete: ModelProvider["complete"], pid = "p1", model = "m1"): { reg: ProviderRegistry; calls: () => number } {
  const reg = createProviderRegistry();
  let n = 0;
  const adapter: ModelProvider = { provider: pid, modelKey: model, complete: async (req) => { n += 1; return complete(req); } };
  reg.register(defineProvider({
    metadata: { id: pid, vendor: pid, displayName: pid, authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
    descriptors: [descriptor(pid, model)], requiredEnv: [], defaultPriority: 10, create: () => adapter, createDefault: () => adapter,
  }));
  return { reg, calls: () => n };
}
const echo: ModelProvider["complete"] = async (req) => ({ ...OK, text: `r:${req.prompt}` });
const fails = (msg: string): ModelProvider["complete"] => async () => { throw new Error(msg); };

function record(over: Partial<ReplayRecord> = {}): ReplayRecord {
  return { recordId: "rec1", sourceExecutionId: "exec-orig", inputMessages: [{ role: "user", content: "hi" }], provider: "p1", model: "m1", workloadType: "chat", ...over };
}
function enabled(over: Partial<ReplayPolicy> = {}): ReplayPolicy {
  return { ...defaultReplayPolicy(), mode: "enabled", ...over };
}
function engineWith(policy: ReplayPolicy) {
  const bus = new ExecutionEventBus();
  const store = new ReplayStore();
  const metrics = new ReplayMetricsCollector();
  bus.subscribe(metrics);
  const explanations = new ExplanationStore();
  bus.subscribe(new ExplainabilityEngine(bus, explanations, new ExplainabilityPolicyStore({ ...defaultExplainabilityPolicy(), mode: "enabled" })));
  let seq = 0;
  const engine = new TrafficReplayEngine(bus, store, new ReplayPolicyStore(policy), { now: () => 0, newReplayId: () => `replay-${++seq}` });
  return { bus, store, metrics, explanations, engine };
}

// ── Record registration + replay through the pipeline ────────────────────────

test("a record is registered and replayed through the public pipeline", async () => {
  const { reg, calls } = registry(echo);
  const e = engineWith(enabled());
  e.engine.register(record());
  const run = await e.engine.replay([record()], { registry: reg });
  assert.ok(run);
  assert.equal(run!.status, "completed");
  assert.equal(run!.results.length, 1);
  const r = run!.results[0]!;
  assert.equal(r.success, true);
  assert.equal(r.isReplay, true, "result is marked as a replay");
  assert.equal(r.provider, "p1");
  assert.equal(r.sourceExecutionId, "exec-orig");
  assert.ok(r.replayExecutionId.length > 0, "an isolated execution id was minted");
  assert.equal(calls(), 1, "the provider was reached exactly once via the pipeline");
});

// ── Isolation: production health + metrics are never contaminated ─────────────

test("replay executions do not contaminate production health or metrics", async () => {
  const { reg } = registry(echo);
  // A PRODUCTION observability bus with a health manager subscribed.
  const prodBus = new ExecutionEventBus();
  const healthStore = new ProviderHealthStore();
  const health = new ProviderHealthManager(prodBus, healthStore, new HealthPolicyStore({ ...defaultHealthPolicy(), mode: "enabled" }), { now: () => 0 });
  prodBus.subscribe(health);
  // Sanity: the production bus + health DO record a real (non-replay) execution.
  const { executeInference } = await import("@/lib/aiops/execution/inference-pipeline");
  const { route } = await import("@/lib/aiops/routing/routing-engine");
  const prodDecision = route({ workloadType: "chat", preferredProvider: "p1", preferredModel: "m1" }, { allowedProviders: ["p1"] }, reg);
  await executeInference({ request: { prompt: "x" }, routingDecision: prodDecision, registry: reg, requestId: "prod-1", tenantId: "real", workloadType: "chat" }, [new ExecutionEventPublisher(prodBus)]);
  assert.ok(healthStore.get("p1", "m1"), "production health tracks real executions");
  healthStore.reset();

  // Now replay on the ISOLATED replay engine (its own bus). Production health must
  // remain empty — replay events never reach the production bus.
  const e = engineWith(enabled());
  await e.engine.replay([record(), record({ recordId: "rec2" })], { registry: reg });
  assert.equal(healthStore.get("p1", "m1"), null, "replay never touches production health");
  // Replay-scoped metrics DID record the replay (observable in isolation).
  assert.equal(e.metrics.snapshot().recordsReplayed, 2);
  assert.equal(e.metrics.snapshot().runs, 1);
});

// ── Replay is observable through the same explanation infrastructure ──────────

test("replays are explainable on the replay-scoped explanation store", async () => {
  const { reg } = registry(echo);
  const e = engineWith(enabled());
  const run = await e.engine.replay([record()], { registry: reg });
  const execId = run!.results[0]!.replayExecutionId;
  const explanation = e.explanations.get(execId);
  assert.ok(explanation, "an explanation was produced on the replay bus");
  assert.equal(explanation!.tenantId, REPLAY_TENANT, "the explanation is marked replay-tenant");
  assert.equal(explanation!.outcome.success, true);
});

// ── Routing-pinned eligibility ───────────────────────────────────────────────

test("a record whose target routing does not select is not_eligible (no provider call)", async () => {
  const { reg, calls } = registry(echo);
  const e = engineWith(enabled());
  const run = await e.engine.replay([record({ provider: "absent", model: "mX" })], { registry: reg });
  const r = run!.results[0]!;
  assert.equal(r.executionOutcome, "not_eligible");
  assert.equal(r.success, false);
  assert.equal(calls(), 0, "no provider invocation for an unrouted target");
});

// ── Failure is captured and marked replay ────────────────────────────────────

test("a provider failure is captured as a failed replay result", async () => {
  const { reg } = registry(fails("503 unavailable"));
  const e = engineWith(enabled());
  const run = await e.engine.replay([record()], { registry: reg });
  const r = run!.results[0]!;
  assert.equal(r.success, false);
  assert.equal(r.executionOutcome, "failure");
  assert.equal(r.errorKind, "provider_unavailable");
  assert.equal(r.isReplay, true);
});

// ── Immutable results ────────────────────────────────────────────────────────

test("replay runs and results are immutable", async () => {
  const { reg } = registry(echo);
  const e = engineWith(enabled());
  const run = await e.engine.replay([record()], { registry: reg });
  assert.equal(Object.isFrozen(run), true);
  assert.equal(Object.isFrozen(run!.results[0]), true);
  assert.throws(() => { (run as { status: string }).status = "failed"; }, TypeError);
});

// ── Disabled no-op ───────────────────────────────────────────────────────────

test("a disabled policy is a no-op (no run, no provider call)", async () => {
  const { reg, calls } = registry(echo);
  const e = engineWith(defaultReplayPolicy()); // disabled
  const run = await e.engine.replay([record()], { registry: reg });
  assert.equal(run, null);
  assert.equal(calls(), 0);
});
