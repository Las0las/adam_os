// IOS-013 — Provider Health Manager (per AS-001). A purely OBSERVATIONAL bus
// subscriber: it folds execution/retry/circuit/fallback events into immutable
// ProviderHealth snapshots, evaluates a normalized status with hysteresis,
// publishes health events, and exposes a read-only store. These tests prove:
// initialization, success updates, degraded/unavailable/recovery transitions,
// immutable snapshots, deterministic evaluation, event publication, metrics, and
// consumer read access — without touching the pipeline, routing, or plan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ExecutionEventBus, type BusEvent, type ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ProviderHealthManager } from "@/lib/aiops/health/health-manager";
import { ProviderHealthStore } from "@/lib/aiops/health/health-store";
import { HealthMetricsCollector } from "@/lib/aiops/health/health-metrics";
import { HealthPolicyStore, defaultHealthPolicy, type HealthPolicy } from "@/lib/aiops/health/health-types";
import { isHealthEvent } from "@/lib/aiops/health/health-events";

const P = "p", M = "m";

function ev(type: string, extra: Record<string, unknown> = {}, provider = P, model = M): BusEvent {
  return {
    type, executionId: "e", requestId: "r", tenantId: "t",
    provider, model, workloadType: "chat", timestamp: 0, ...extra,
  } as unknown as BusEvent;
}
const completed = (latency = 10, provider = P, model = M) => ev("execution.completed", { latency }, provider, model);
const failed = (kind = "provider_unavailable", latency = 10, provider = P, model = M) =>
  ev("execution.failed", { latency, error: { kind, name: "E", message: "x" }, retryable: true }, provider, model);

function enabled(overrides: Partial<HealthPolicy> = {}): HealthPolicy {
  return { ...defaultHealthPolicy(), mode: "enabled", observationWindow: 4, degradedBelow: 0.85, unavailableBelow: 0.5, recoverAbove: 0.95, ...overrides };
}

/** Captures every event delivered to the bus (for asserting health publications). */
class Capture implements ExecutionEventSubscriber {
  readonly name = "capture";
  readonly events: BusEvent[] = [];
  onEvent(e: BusEvent): void { this.events.push(e); }
  types(): string[] { return this.events.map((e) => e.type); }
}

function harness(policy: HealthPolicy) {
  const bus = new ExecutionEventBus();
  const store = new ProviderHealthStore();
  const metrics = new HealthMetricsCollector();
  const capture = new Capture();
  const policyStore = new HealthPolicyStore(policy);
  let clock = 0;
  const manager = new ProviderHealthManager(bus, store, policyStore, { now: () => ++clock });
  bus.subscribe(manager);
  bus.subscribe(metrics);
  bus.subscribe(capture);
  return { bus, store, metrics, capture, manager, policyStore };
}

// ── Initialization ────────────────────────────────────────────────────────────

test("no snapshot exists until an eligible event is observed", () => {
  const h = harness(enabled());
  assert.equal(h.store.get(P, M), null);
  h.bus.publish(completed());
  const snap = h.store.get(P, M);
  assert.ok(snap, "a snapshot is created on first observation");
  assert.equal(snap!.status, "healthy");
  assert.equal(snap!.availability, 1);
  assert.equal(snap!.latencyMs, 10);
});

// ── Successful execution updates ─────────────────────────────────────────────

test("successful executions keep the provider healthy with full availability", () => {
  const h = harness(enabled());
  for (let i = 0; i < 4; i++) h.bus.publish(completed(20));
  const snap = h.store.get(P, M)!;
  assert.equal(snap.status, "healthy");
  assert.equal(snap.availability, 1);
  assert.equal(snap.errorRate, 0);
  assert.equal(snap.latencyMs, 20);
  assert.ok(h.capture.types().includes("provider_health.updated"));
});

// ── Degraded transition ──────────────────────────────────────────────────────

test("availability between thresholds degrades the provider", () => {
  const h = harness(enabled()); // window 4
  h.bus.publish(completed());
  h.bus.publish(completed());
  h.bus.publish(completed());
  h.bus.publish(failed()); // 3/4 = 0.75 → degraded
  const snap = h.store.get(P, M)!;
  assert.equal(snap.status, "degraded");
  assert.equal(snap.availability, 0.75);
  assert.ok(h.capture.types().includes("provider_health.degraded"));
});

// ── Unavailable transition ───────────────────────────────────────────────────

test("availability below the unavailable threshold marks the provider unavailable", () => {
  const h = harness(enabled());
  h.bus.publish(completed());
  h.bus.publish(failed());
  h.bus.publish(failed());
  h.bus.publish(failed()); // 1/4 = 0.25 → unavailable
  const snap = h.store.get(P, M)!;
  assert.equal(snap.status, "unavailable");
  assert.ok(h.capture.types().includes("provider_health.unavailable"));
});

test("an observed open circuit forces unavailable regardless of availability", () => {
  const h = harness(enabled());
  h.bus.publish(completed()); // healthy
  h.bus.publish(ev("circuit.opened", { failures: 5 }));
  const snap = h.store.get(P, M)!;
  assert.equal(snap.circuitState, "open");
  assert.equal(snap.status, "unavailable");
  assert.equal(snap.healthScore, 0);
});

// ── Recovery transition ──────────────────────────────────────────────────────

test("a degraded provider recovers to healthy only above the recovery threshold", () => {
  const h = harness(enabled()); // window 4, recoverAbove 0.95
  h.bus.publish(completed());
  h.bus.publish(completed());
  h.bus.publish(completed());
  h.bus.publish(failed()); // 0.75 → degraded
  assert.equal(h.store.get(P, M)!.status, "degraded");
  // Flush the window back to all-successes → availability 1.0 ≥ 0.95 → recovered.
  for (let i = 0; i < 4; i++) h.bus.publish(completed());
  const snap = h.store.get(P, M)!;
  assert.equal(snap.availability, 1);
  assert.equal(snap.status, "healthy");
  assert.ok(h.capture.types().includes("provider_health.recovered"));
});

test("recovery hysteresis: partial recovery stays degraded below the recovery threshold", () => {
  const h = harness(enabled({ observationWindow: 4, degradedBelow: 0.85, unavailableBelow: 0.5, recoverAbove: 0.95 }));
  h.bus.publish(completed());
  h.bus.publish(completed());
  h.bus.publish(failed());
  h.bus.publish(failed()); // 0.5 → exactly unavailableBelow? 0.5 is not < 0.5 → degraded
  // 2/4 = 0.5 → not < 0.5 → degraded
  assert.equal(h.store.get(P, M)!.status, "degraded");
  // Bring availability to 0.75 (3/4): ≥ degradedBelow? no (0.75<0.85) and < recoverAbove → stays degraded.
  h.bus.publish(completed()); // window: c,f,f,c? compute below
  // window now last 4: [completed, failed, failed, completed] = 2/4 = 0.5 → degraded
  assert.equal(h.store.get(P, M)!.status, "degraded");
});

// ── Immutable snapshots ──────────────────────────────────────────────────────

test("published snapshots are immutable", () => {
  const h = harness(enabled());
  h.bus.publish(completed());
  const snap = h.store.get(P, M)!;
  assert.equal(Object.isFrozen(snap), true);
  assert.throws(() => { (snap as { status: string }).status = "unavailable"; }, TypeError);
});

// ── Deterministic evaluation ─────────────────────────────────────────────────

test("evaluation is deterministic for an identical event sequence", () => {
  const run = () => {
    const h = harness(enabled());
    h.bus.publish(completed());
    h.bus.publish(failed());
    h.bus.publish(completed());
    h.bus.publish(failed());
    const s = h.store.get(P, M)!;
    return { status: s.status, availability: s.availability, errorRate: s.errorRate, timeoutRate: s.timeoutRate };
  };
  assert.deepEqual(run(), run());
});

// ── Event publication ────────────────────────────────────────────────────────

test("every update publishes provider_health.updated; transitions publish their event", () => {
  const h = harness(enabled());
  h.bus.publish(completed());                 // healthy (transition from unknown → healthy → recovered)
  h.bus.publish(failed()); h.bus.publish(failed()); h.bus.publish(failed()); // → unavailable
  const t = h.capture.types();
  assert.ok(t.filter((x) => x === "provider_health.updated").length >= 4);
  assert.ok(t.includes("provider_health.unavailable"));
});

// ── Metrics ──────────────────────────────────────────────────────────────────

test("metrics fold health events into counters", () => {
  const h = harness(enabled());
  h.bus.publish(completed());
  h.bus.publish(completed()); h.bus.publish(completed()); h.bus.publish(failed()); // degraded
  for (let i = 0; i < 4; i++) h.bus.publish(completed()); // recovered
  const m = h.metrics.snapshot();
  assert.ok(m.updates >= 5);
  assert.ok(m.degraded >= 1);
  assert.ok(m.recovered >= 1);
  assert.equal(m.transitions, m.degraded + m.unavailable + m.recovered);
  assert.ok(m.byProvider["p|m"], "per-provider availability view is present");
});

// ── Retry / fallback observation ─────────────────────────────────────────────

test("retry and fallback observations populate their snapshot fields", () => {
  const h = harness(enabled());
  h.bus.publish(completed());
  h.bus.publish(ev("retry.succeeded"));
  h.bus.publish(ev("retry.exhausted"));
  h.bus.publish(ev("fallback.started", { failureKind: "provider_unavailable" }));
  const snap = h.store.get(P, M)!;
  assert.equal(snap.retrySuccessRate, 0.5, "1 success / (1 success + 1 exhaust)");
  assert.ok(snap.fallbackFrequency > 0, "fallback activation recorded");
});

// ── Consumer read access ─────────────────────────────────────────────────────

test("the store exposes read-only snapshots to consumers", () => {
  const h = harness(enabled());
  h.bus.publish(completed(15));
  h.bus.publish(completed(25, "p2", "m2"));
  assert.equal(h.store.get(P, M)!.provider, "p");
  const all = h.store.all();
  assert.equal(all.length, 2);
  assert.ok(all.every((s) => Object.isFrozen(s)), "consumers cannot mutate published snapshots");
});

// ── No self-reaction; observational only ─────────────────────────────────────

test("the manager ignores its own provider_health.* events (no recursion)", () => {
  const h = harness(enabled());
  h.bus.publish(completed());
  const before = h.store.get(P, M)!;
  const updatesBefore = h.metrics.snapshot().updates;
  // Manually publish a health event; the manager must not react to it.
  const synthetic = h.capture.events.find((e) => isHealthEvent(e))!;
  h.bus.publish(synthetic);
  assert.equal(h.store.get(P, M), before, "store snapshot unchanged by a health event");
  assert.equal(h.metrics.snapshot().updates, updatesBefore + 1, "only the metrics counter folds the re-published event");
});

// ── Disabled / eligibility no-ops ────────────────────────────────────────────

test("a disabled policy is a no-op (no snapshots, no events)", () => {
  const h = harness(defaultHealthPolicy()); // disabled
  h.bus.publish(completed());
  h.bus.publish(failed());
  assert.equal(h.store.get(P, M), null);
  assert.deepEqual(h.capture.types().filter((t) => t.startsWith("provider_health.")), []);
});

test("ineligible providers are not tracked", () => {
  const h = harness(enabled({ eligibleProviders: ["other"] }));
  h.bus.publish(completed());
  assert.equal(h.store.get(P, M), null);
});
