// IOS-020 — SLA Management Engine (per AS-001). Purely advisory: it consumes
// provider health (IOS-013) — and, by reference, published metadata (IOS-018),
// evaluation/benchmark/execution evidence and the abstract Recommendation
// contract — and produces immutable SLARecommendation objects (a concrete
// specialization of the shared Recommendation taxonomy). These tests prove:
// breach severity → escalate/mitigate/investigate; no_change when the objective is
// met; immutability; read-only consumption of ProviderHealthSnapshot; the base
// Recommendation contract is reused (producerSpecification "IOS-020"); eligibility;
// and disabled no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLAManagementEngine } from "@/lib/aiops/sla/sla-engine";
import { RecommendationStore } from "@/lib/aiops/recommendation/recommendation-store";
import { SLAPolicyStore, defaultSLAPolicy, type SLAPolicy } from "@/lib/aiops/sla/sla-types";
import type { SLAAnalysisInput } from "@/lib/aiops/sla/sla-analyzer";
import type { ProviderHealthSnapshot } from "@/lib/aiops/health/health-types";

function health(
  provider: string,
  model: string,
  over: Partial<ProviderHealthSnapshot> = {},
): ProviderHealthSnapshot {
  return {
    provider, model, status: "healthy",
    availability: 1, latencyMs: 100, timeoutRate: 0, errorRate: 0,
    retrySuccessRate: 1, circuitState: "closed", fallbackFrequency: 0,
    healthScore: 1, lastUpdated: 0, ...over,
  };
}
function enabled(over: Partial<SLAPolicy> = {}): SLAPolicy {
  return { ...defaultSLAPolicy(), mode: "enabled", ...over };
}
function engineWith(policy: SLAPolicy) {
  const store = new RecommendationStore();
  let seq = 0;
  const engine = new SLAManagementEngine(store, new SLAPolicyStore(policy), { now: () => 0, newRecommendationId: (k) => `sla-${k}-${++seq}` });
  return { store, engine };
}

// ── Breach severity → escalate (unavailable) ─────────────────────────────────

test("an unavailable subject below target → escalate / critical", () => {
  const input: SLAAnalysisInput = { health: [health("p1", "m", { status: "unavailable", availability: 0 })] };
  const r = engineWith(enabled({ objective: { targetAvailability: 0.99, maxLatencyMs: null, maxErrorRate: null } })).engine.recommend(input)[0]!;
  assert.equal(r.recommendationType, "sla");
  assert.equal(r.producerSpecification, "IOS-020");
  assert.equal(r.recommendationStatus, "proposed");
  assert.equal(r.action, "escalate");
  assert.equal(r.priority, "critical");
  assert.equal(r.breached, true);
  assert.deepEqual(r.breachedDimensions, ["availability"]);
});

// ── Breach severity → mitigate (≥2 dimensions) ───────────────────────────────

test("two breached dimensions → mitigate / high", () => {
  const input: SLAAnalysisInput = {
    health: [health("p1", "m", { status: "degraded", availability: 0.9, latencyMs: 5_000, errorRate: 0.2 })],
  };
  const r = engineWith(enabled({ objective: { targetAvailability: 0.99, maxLatencyMs: 1_000, maxErrorRate: 0.05 } })).engine.recommend(input)[0]!;
  assert.equal(r.action, "mitigate");
  assert.equal(r.priority, "high");
  assert.equal(r.breachedDimensions.length >= 2, true);
});

// ── Breach severity → investigate (single dimension) ─────────────────────────

test("a single breached dimension → investigate / medium", () => {
  const input: SLAAnalysisInput = {
    health: [health("p1", "m", { status: "degraded", availability: 0.95 })],
  };
  const r = engineWith(enabled({ objective: { targetAvailability: 0.99, maxLatencyMs: null, maxErrorRate: null } })).engine.recommend(input)[0]!;
  assert.equal(r.action, "investigate");
  assert.equal(r.priority, "medium");
  assert.deepEqual(r.breachedDimensions, ["availability"]);
  assert.ok(r.estimatedImpact > 0);
});

// ── No change when the objective is met ──────────────────────────────────────

test("a subject meeting the objective → no_change / low", () => {
  const input: SLAAnalysisInput = { health: [health("p1", "m", { availability: 1, latencyMs: 50, errorRate: 0 })] };
  const r = engineWith(enabled({ objective: { targetAvailability: 0.99, maxLatencyMs: 1_000, maxErrorRate: 0.05 } })).engine.recommend(input)[0]!;
  assert.equal(r.action, "no_change");
  assert.equal(r.priority, "low");
  assert.equal(r.breached, false);
  assert.deepEqual(r.breachedDimensions, []);
  assert.equal(r.estimatedImpact, 0);
});

// ── Immutability ─────────────────────────────────────────────────────────────

test("produced SLARecommendations are immutable", () => {
  const input: SLAAnalysisInput = { health: [health("p1", "m")] };
  const r = engineWith(enabled()).engine.recommend(input)[0]!;
  assert.equal(Object.isFrozen(r), true);
  assert.throws(() => { (r as { action: string }).action = "escalate"; }, TypeError);
});

// ── Read-only consumption of ProviderHealthSnapshot ──────────────────────────

test("recommending does not mutate the consumed health snapshots", () => {
  const input: SLAAnalysisInput = {
    health: [health("p1", "m", { status: "degraded", availability: 0.9 }), health("p2", "n")],
  };
  const snapshot = JSON.stringify(input);
  engineWith(enabled()).engine.recommend(input);
  assert.equal(JSON.stringify(input), snapshot, "consumed health snapshots are unchanged");
});

// ── Taxonomy: base Recommendation reused, stored under the canonical taxonomy ─

test("SLARecommendation is a specialization of the base Recommendation contract", () => {
  const input: SLAAnalysisInput = { health: [health("p1", "m")] };
  const e = engineWith(enabled());
  e.engine.recommend(input);
  const base = e.store.byType("sla");
  assert.equal(base.length, 1);
  assert.equal(base[0]!.recommendationType, "sla");
  assert.equal(base[0]!.producerSpecification, "IOS-020");
  // Every v1.0 abstract base field is present on the concrete specialization.
  for (const f of ["recommendationId", "recommendationType", "priority", "confidence", "rationale", "evidenceReferences", "estimatedImpact", "estimatedCost", "estimatedBenefit", "createdAt", "producerSpecification", "recommendationStatus"]) {
    assert.ok(f in base[0]!, `base contract field "${f}" present`);
  }
});

// ── Eligibility + disabled no-op ─────────────────────────────────────────────

test("ineligible providers are not analyzed", () => {
  const input: SLAAnalysisInput = { health: [health("p1", "m")] };
  const recs = engineWith(enabled({ eligibleProviders: ["other"] })).engine.recommend(input);
  assert.deepEqual(recs, []);
});

test("a disabled policy is a no-op", () => {
  const input: SLAAnalysisInput = { health: [health("p1", "m", { status: "unavailable", availability: 0 })] };
  assert.deepEqual(engineWith(defaultSLAPolicy()).engine.recommend(input), []);
});
