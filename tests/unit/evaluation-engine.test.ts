// IOS-017 — Evaluation Engine (per AS-001). An observational subsystem that scores
// COMPLETED executions and produces the canonical EvaluationResult/EvaluationReport.
// These tests prove: deterministic scoring (success/latency/no_fallback/output),
// canonical report aggregation, event publication, metrics, immutability,
// evaluation OVER an IOS-016 isolated replay run (reusing the Isolated Execution
// Environment), production non-contamination, eligibility, and disabled no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { EvaluationEngine } from "@/lib/aiops/evaluation/evaluation-engine";
import { EvaluationStore } from "@/lib/aiops/evaluation/evaluation-store";
import { EvaluationMetricsCollector } from "@/lib/aiops/evaluation/evaluation-metrics";
import { EvaluationPolicyStore, defaultEvaluationPolicy, type EvaluationPolicy, type EvaluationSubject } from "@/lib/aiops/evaluation/evaluation-types";
// IOS-016 isolated execution environment + IOS-013 production health (for the
// non-contamination test).
import { TrafficReplayEngine } from "@/lib/aiops/replay/replay-engine";
import { ReplayStore } from "@/lib/aiops/replay/replay-store";
import { ReplayPolicyStore, defaultReplayPolicy, type ReplayRecord } from "@/lib/aiops/replay/replay-types";
import { ProviderHealthManager } from "@/lib/aiops/health/health-manager";
import { ProviderHealthStore } from "@/lib/aiops/health/health-store";
import { HealthPolicyStore, defaultHealthPolicy } from "@/lib/aiops/health/health-types";

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
function registry(complete: ModelProvider["complete"], pid = "p1", model = "m1"): ProviderRegistry {
  const reg = createProviderRegistry();
  const adapter: ModelProvider = { provider: pid, modelKey: model, complete };
  reg.register(defineProvider({
    metadata: { id: pid, vendor: pid, displayName: pid, authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
    descriptors: [descriptor(pid, model)], requiredEnv: [], defaultPriority: 10, create: () => adapter, createDefault: () => adapter,
  }));
  return reg;
}
const echo: ModelProvider["complete"] = async (req) => ({ ...OK, text: `r:${req.prompt}` });

function subject(over: Partial<EvaluationSubject> = {}): EvaluationSubject {
  return { subjectId: "s1", provider: "p1", model: "m1", workloadType: "chat", success: true, errorKind: null, latencyMs: 10, response: "hello world", fallbackOccurred: false, ...over };
}
function enabled(over: Partial<EvaluationPolicy> = {}): EvaluationPolicy {
  return { ...defaultEvaluationPolicy(), mode: "enabled", ...over };
}
function engineWith(policy: EvaluationPolicy) {
  const bus = new ExecutionEventBus();
  const store = new EvaluationStore();
  const metrics = new EvaluationMetricsCollector();
  bus.subscribe(metrics);
  let seq = 0;
  const engine = new EvaluationEngine(bus, store, new EvaluationPolicyStore(policy), { now: () => 0, newEvaluationId: () => `eval-${++seq}` });
  return { bus, store, metrics, engine };
}

// ── Deterministic scoring + canonical report ─────────────────────────────────

test("subjects are scored against the policy criteria into a canonical report", () => {
  const e = engineWith(enabled({ criteria: [{ type: "must_succeed" }, { type: "max_latency", value: 50 }] }));
  const report = e.engine.evaluate([
    subject({ subjectId: "a", success: true, latencyMs: 10 }),  // both pass
    subject({ subjectId: "b", success: false, latencyMs: 10 }), // must_succeed fails
    subject({ subjectId: "c", success: true, latencyMs: 99 }),  // latency fails
  ])!;
  assert.equal(report.total, 3);
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 2);
  assert.equal(report.results.find((r) => r.subjectId === "a")!.passed, true);
  assert.equal(report.results.find((r) => r.subjectId === "a")!.score, 1);
  assert.equal(report.results.find((r) => r.subjectId === "b")!.score, 0.5);
  assert.equal(report.byProvider.p1?.passRate, 1 / 3);
});

test("output and no_fallback criteria score deterministically", () => {
  const e = engineWith(enabled({ criteria: [{ type: "output_contains", value: "world" }, { type: "no_fallback" }] }));
  const report = e.engine.evaluate([
    subject({ subjectId: "a", response: "hello world", fallbackOccurred: false }), // pass both
    subject({ subjectId: "b", response: "hello", fallbackOccurred: true }),        // fail both
  ])!;
  assert.equal(report.results.find((r) => r.subjectId === "a")!.passed, true);
  assert.equal(report.results.find((r) => r.subjectId === "b")!.score, 0);
});

// ── Events + metrics ─────────────────────────────────────────────────────────

test("evaluation publishes events and folds into metrics", () => {
  const e = engineWith(enabled());
  e.engine.evaluate([subject({ subjectId: "a" }), subject({ subjectId: "b", success: false })]);
  const m = e.metrics.snapshot();
  assert.equal(m.evaluations, 1);
  assert.equal(m.subjectsEvaluated, 2);
  assert.equal(m.passed, 1);
  assert.equal(m.failed, 1);
});

// ── Immutability ─────────────────────────────────────────────────────────────

test("evaluation results and reports are immutable", () => {
  const e = engineWith(enabled());
  const report = e.engine.evaluate([subject()])!;
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.results[0]), true);
  assert.throws(() => { (report as { passed: number }).passed = 99; }, TypeError);
});

// ── Evaluation over an IOS-016 isolated replay run ───────────────────────────

test("an IOS-016 replay run can be evaluated; production health is not contaminated", async () => {
  const reg = registry(echo);
  // Production health on the PRODUCTION bus — must stay empty through replay+eval.
  const prodBus = new ExecutionEventBus();
  const healthStore = new ProviderHealthStore();
  prodBus.subscribe(new ProviderHealthManager(prodBus, healthStore, new HealthPolicyStore({ ...defaultHealthPolicy(), mode: "enabled" }), { now: () => 0 }));

  // Run records through the IOS-016 Isolated Execution Environment.
  const replayBus = new ExecutionEventBus();
  const replay = new TrafficReplayEngine(replayBus, new ReplayStore(), new ReplayPolicyStore({ ...defaultReplayPolicy(), mode: "enabled" }), { now: () => 0, newReplayId: () => "replay-1" });
  const records: ReplayRecord[] = [
    { recordId: "rec1", inputMessages: [{ role: "user", content: "hi" }], provider: "p1", model: "m1", workloadType: "chat" },
    { recordId: "rec2", inputMessages: [{ role: "user", content: "yo" }], provider: "p1", model: "m1", workloadType: "chat" },
  ];
  const run = (await replay.replay(records, { registry: reg }))!;

  // Evaluate the isolated replay run.
  const e = engineWith(enabled({ criteria: [{ type: "must_succeed" }] }));
  const report = e.engine.evaluateReplayRun(run)!;
  assert.equal(report.total, 2);
  assert.equal(report.passed, 2, "both replayed executions succeeded");

  // Neither replay nor evaluation touched production health.
  assert.equal(healthStore.get("p1", "m1"), null, "production health never saw replay/evaluation");
});

// ── Canonical Object Contract conformance ────────────────────────────────────

test("evaluating a ReplayRun does not mutate the consumed (canonical) run", async () => {
  const reg = registry(echo);
  const replayBus = new ExecutionEventBus();
  const replay = new TrafficReplayEngine(replayBus, new ReplayStore(), new ReplayPolicyStore({ ...defaultReplayPolicy(), mode: "enabled" }), { now: () => 0, newReplayId: () => "replay-1" });
  const run = (await replay.replay([{ recordId: "rec1", inputMessages: [{ role: "user", content: "hi" }], provider: "p1", model: "m1", workloadType: "chat" }], { registry: reg }))!;

  const snapshot = JSON.stringify(run);
  const e = engineWith(enabled());
  e.engine.evaluateReplayRun(run);
  // Consumed object is read-only: frozen and byte-for-byte unchanged.
  assert.equal(Object.isFrozen(run), true);
  assert.equal(Object.isFrozen(run.results[0]), true);
  assert.equal(JSON.stringify(run), snapshot, "the consumed ReplayRun is unchanged after evaluation");
});

test("the engine produces results without any provider/registry (no invocation, no authority inversion)", () => {
  // evaluate() over pre-completed subjects needs no registry — the engine never
  // invokes providers or routes; it only scores observations.
  const e = engineWith(enabled());
  const report = e.engine.evaluate([subject({ subjectId: "a" })])!;
  assert.equal(report.total, 1);
  assert.equal(Object.isFrozen(report), true);
});

// ── Eligibility + disabled no-op ─────────────────────────────────────────────

test("ineligible providers are not evaluated", () => {
  const e = engineWith(enabled({ eligibleProviders: ["other"] }));
  const report = e.engine.evaluate([subject()])!;
  assert.equal(report.total, 0);
});

test("a disabled policy is a no-op (no report)", () => {
  const e = engineWith(defaultEvaluationPolicy()); // disabled
  assert.equal(e.engine.evaluate([subject()]), null);
});
