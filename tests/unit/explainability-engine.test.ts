// IOS-015 — Explainability Engine (per AS-001). A purely OBSERVATIONAL bus
// subscriber that correlates the events of one execution into an immutable
// Explanation (routing + security/cache/retry/circuit/fallback signals + outcome),
// reading the canonical objects (RoutingDecision/ExecutionPlan, ProviderHealth by
// reference) without mutating them. These tests prove: full correlation, failure
// explanation, pre-window events ignored, immutability, determinism, event
// publication, metrics, self-reaction guard, retention bound, and disabled no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deepFreeze, type RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { ExecutionEventBus, type BusEvent, type ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExplainabilityEngine } from "@/lib/aiops/explainability/explainability-engine";
import { ExplanationStore } from "@/lib/aiops/explainability/explanation-store";
import { ExplainabilityMetricsCollector } from "@/lib/aiops/explainability/explainability-metrics";
import { ExplainabilityPolicyStore, defaultExplainabilityPolicy, type ExplainabilityPolicy } from "@/lib/aiops/explainability/explainability-types";
import { isExplanationEvent } from "@/lib/aiops/explainability/explainability-events";

function decision(): RoutingDecision {
  return deepFreeze({
    selectedProvider: "p", selectedModel: "m",
    evaluatedProviders: ["p", "p2"],
    rejectionReasons: [{ provider: "p2", model: "m2", reason: "capability" }],
    policySnapshot: {},
    executionPlan: { targets: [{ provider: "p", model: "m" }, { provider: "p2", model: "m2" }] },
  });
}
function ev(type: string, executionId: string, extra: Record<string, unknown> = {}): BusEvent {
  return { type, executionId, requestId: "r", tenantId: "t", provider: "p", model: "m", workloadType: "chat", timestamp: 0, ...extra } as unknown as BusEvent;
}
const started = (id: string) => ev("execution.started", id, { routingDecision: decision(), requestFingerprint: "fp", startTime: 0 });
const completed = (id: string, latency = 12) => ev("execution.completed", id, { routingDecision: decision(), latency, usage: null, finishReason: "stop", responseFingerprint: "rf", startTime: 0 });
const failed = (id: string, kind = "timeout", latency = 5) => ev("execution.failed", id, { routingDecision: decision(), latency, error: { kind, name: "E", message: "x" }, retryable: true, responseFingerprint: "rf", startTime: 0 });

class Capture implements ExecutionEventSubscriber {
  readonly name = "capture";
  readonly events: BusEvent[] = [];
  onEvent(e: BusEvent): void { this.events.push(e); }
  types(): string[] { return this.events.map((e) => e.type); }
}

function harness(policy: ExplainabilityPolicy = { ...defaultExplainabilityPolicy(), mode: "enabled" }) {
  const bus = new ExecutionEventBus();
  const store = new ExplanationStore();
  const metrics = new ExplainabilityMetricsCollector();
  const capture = new Capture();
  const engine = new ExplainabilityEngine(bus, store, new ExplainabilityPolicyStore(policy));
  bus.subscribe(engine);
  bus.subscribe(metrics);
  bus.subscribe(capture);
  return { bus, store, metrics, capture, engine };
}

// ── Full correlation ─────────────────────────────────────────────────────────

test("an execution's events are correlated into a complete explanation", () => {
  const h = harness();
  h.bus.publish(started("x"));
  h.bus.publish(ev("security.prompt_inspected", "x", { outcome: "allowed", rules: [] }));
  h.bus.publish(ev("cache.hit", "x"));
  h.bus.publish(ev("retry.attempt", "x", { delayMs: 10 }));
  h.bus.publish(ev("retry.succeeded", "x"));
  h.bus.publish(ev("circuit.opened", "x", { failures: 3 }));
  h.bus.publish(ev("fallback.started", "x", { failureKind: "provider_unavailable" }));
  h.bus.publish(ev("fallback.succeeded", "x", { targetProvider: "p2", targetModel: "m2", attempt: 1, latencyMs: 5 }));
  h.bus.publish(completed("x"));

  const e = h.store.get("x")!;
  assert.ok(e, "an explanation was produced");
  assert.deepEqual(e.routing.planTargets, [{ provider: "p", model: "m" }, { provider: "p2", model: "m2" }]);
  assert.equal(e.routing.selectedProvider, "p");
  assert.deepEqual(e.routing.evaluatedProviders, ["p", "p2"]);
  assert.equal(e.routing.rejections.length, 1);
  assert.equal(e.security.inspected, true);
  assert.equal(e.security.promptOutcome, "allowed");
  assert.deepEqual(e.cache, { lookedUp: true, hit: true });
  assert.deepEqual(e.retry, { attempts: 1, outcome: "succeeded" });
  assert.equal(e.circuit.state, "open");
  assert.equal(e.fallback.occurred, true);
  assert.deepEqual(e.fallback.target, { provider: "p2", model: "m2" });
  assert.equal(e.healthRef, "p|m");
  assert.deepEqual(e.outcome, { success: true, errorKind: null, latencyMs: 12 });
});

// ── Failure explanation ──────────────────────────────────────────────────────

test("a failed execution records the outcome and error kind", () => {
  const h = harness();
  h.bus.publish(started("x"));
  h.bus.publish(failed("x", "provider_unavailable", 7));
  const e = h.store.get("x")!;
  assert.deepEqual(e.outcome, { success: false, errorKind: "provider_unavailable", latencyMs: 7 });
});

// ── Pre-window events ignored ────────────────────────────────────────────────

test("intermediate events with no started window do not produce an explanation", () => {
  const h = harness();
  h.bus.publish(ev("security.prompt_inspected", "orphan", { outcome: "allowed", rules: [] }));
  h.bus.publish(ev("retry.attempt", "orphan", { delayMs: 1 }));
  assert.equal(h.store.get("orphan"), null);
  assert.deepEqual(h.capture.types().filter((t) => t === "explanation.produced"), []);
});

// ── Immutability ─────────────────────────────────────────────────────────────

test("produced explanations are immutable", () => {
  const h = harness();
  h.bus.publish(started("x"));
  h.bus.publish(completed("x"));
  const e = h.store.get("x")!;
  assert.equal(Object.isFrozen(e), true);
  assert.equal(Object.isFrozen(e.routing), true);
  assert.throws(() => { (e.outcome as { success: boolean }).success = false; }, TypeError);
});

// ── Determinism ──────────────────────────────────────────────────────────────

test("explanation production is deterministic for an identical event sequence", () => {
  const run = () => {
    const h = harness();
    h.bus.publish(started("x"));
    h.bus.publish(ev("security.prompt_inspected", "x", { outcome: "flagged", rules: ["r"] }));
    h.bus.publish(ev("retry.attempt", "x", { delayMs: 1 }));
    h.bus.publish(failed("x", "timeout", 3));
    return JSON.stringify(h.store.get("x"));
  };
  assert.equal(run(), run());
});

// ── Event publication + metrics ──────────────────────────────────────────────

test("each finalized explanation publishes explanation.produced and folds into metrics", () => {
  const h = harness();
  h.bus.publish(started("x"));
  h.bus.publish(ev("retry.attempt", "x", { delayMs: 1 }));
  h.bus.publish(ev("fallback.started", "x", { failureKind: "timeout" }));
  h.bus.publish(ev("cache.hit", "x"));
  h.bus.publish(completed("x"));
  assert.ok(h.capture.types().includes("explanation.produced"));
  const m = h.metrics.snapshot();
  assert.equal(m.produced, 1);
  assert.equal(m.successes, 1);
  assert.equal(m.withRetry, 1);
  assert.equal(m.withFallback, 1);
  assert.equal(m.cacheHits, 1);
});

// ── Self-reaction guard ──────────────────────────────────────────────────────

test("the engine ignores its own explanation.produced events", () => {
  const h = harness();
  h.bus.publish(started("x"));
  h.bus.publish(completed("x"));
  const producedBefore = h.metrics.snapshot().produced;
  const synthetic = h.capture.events.find((e) => isExplanationEvent(e))!;
  h.bus.publish(synthetic); // re-publish the engine's own event
  // The engine did not create another explanation; only the metrics collector folded it.
  assert.equal(h.store.all().length, 1);
  assert.equal(h.metrics.snapshot().produced, producedBefore + 1);
});

// ── Retention bound ──────────────────────────────────────────────────────────

test("the store is bounded by the retention policy", () => {
  const h = harness({ ...defaultExplainabilityPolicy(), mode: "enabled", retain: 3 });
  for (let i = 0; i < 6; i++) { h.bus.publish(started(`x${i}`)); h.bus.publish(completed(`x${i}`)); }
  assert.equal(h.store.all().length, 3, "only the most recent 3 are retained");
  assert.equal(h.store.get("x0"), null, "the oldest was evicted");
  assert.ok(h.store.get("x5"), "the newest is retained");
});

// ── Disabled / eligibility no-ops ────────────────────────────────────────────

test("a disabled policy is a no-op (no explanations, no events)", () => {
  const h = harness(defaultExplainabilityPolicy()); // disabled
  h.bus.publish(started("x"));
  h.bus.publish(completed("x"));
  assert.equal(h.store.get("x"), null);
  assert.deepEqual(h.capture.types().filter((t) => t.startsWith("explanation.")), []);
});

test("ineligible providers are not explained", () => {
  const h = harness({ ...defaultExplainabilityPolicy(), mode: "enabled", eligibleProviders: ["other"] });
  h.bus.publish(started("x"));
  h.bus.publish(completed("x"));
  assert.equal(h.store.get("x"), null);
});
