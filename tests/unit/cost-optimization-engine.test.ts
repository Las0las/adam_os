// IOS-019 — Cost Optimization Engine (per AS-001). Purely advisory: it consumes
// published metadata (IOS-018), cost observations, benchmark/health/evaluation
// evidence BY REFERENCE and produces immutable CostRecommendation objects (the
// first specialization of the canonical Recommendation family). These tests prove:
// recommend a cheaper no-worse alternative, no_change when competitive, quality/
// health gating of alternatives, immutability, read-only consumption, advisory
// flag, taxonomy (base Recommendation reused), eligibility, and disabled no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CostOptimizationEngine } from "@/lib/aiops/recommendation/cost-engine";
import { RecommendationStore } from "@/lib/aiops/recommendation/recommendation-store";
import { CostOptimizationPolicyStore, defaultCostOptimizationPolicy, type CostObservation, type CostOptimizationPolicy } from "@/lib/aiops/recommendation/recommendation-types";
import type { CostAnalysisInput } from "@/lib/aiops/recommendation/cost-analyzer";
import { deriveCapability } from "@/lib/aiops/capability/capability-types";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { ProviderHealthSnapshot } from "@/lib/aiops/health/health-types";

function desc(provider: string, model: string, inPer: number, outPer: number): ModelDescriptor {
  return {
    provider, publisher: "acme", family: "fam", model, version: null,
    contextWindow: 128_000, supportsVision: false, supportsTools: false, supportsStreaming: false,
    supportsJSON: true, supportsReasoning: false, supportsEmbeddings: false,
    pricing: { inputPerMTok: inPer, outputPerMTok: outPer }, deprecated: false,
  };
}
function cap(provider: string, model: string, inPer: number, outPer: number) {
  return deriveCapability(desc(provider, model, inPer, outPer));
}
function obs(provider: string, model: string, costUsd: number, totalTokens: number): CostObservation {
  return { provider, model, costUsd, totalTokens };
}
function enabled(over: Partial<CostOptimizationPolicy> = {}): CostOptimizationPolicy {
  return { ...defaultCostOptimizationPolicy(), mode: "enabled", ...over };
}
function engineWith(policy: CostOptimizationPolicy) {
  const store = new RecommendationStore();
  let seq = 0;
  const engine = new CostOptimizationEngine(store, new CostOptimizationPolicyStore(policy), { now: () => 0, newRecommendationId: (k) => `rec-${k}-${++seq}` });
  return { store, engine };
}

// ── Recommend a cheaper, no-worse alternative ────────────────────────────────

test("recommends switching to a cheaper, no-worse alternative", () => {
  const input: CostAnalysisInput = {
    capabilities: [cap("p1", "expensive", 20, 40), cap("p2", "cheap", 2, 4)],
    observations: [obs("p1", "expensive", 1, 1_000_000)],
  };
  const e = engineWith(enabled({ savingsThresholdPct: 10 }));
  const recs = e.engine.recommend(input);
  assert.equal(recs.length, 1);
  const r = recs[0]!;
  assert.equal(r.kind, "cost");
  assert.equal(r.advisory, true);
  assert.equal(r.subject.model, "expensive");
  assert.equal(r.action, "switch_model");
  assert.deepEqual(r.alternative?.model, "cheap");
  assert.ok((r.projectedSavingsPct ?? 0) > 80);
});

// ── No change when competitive ───────────────────────────────────────────────

test("recommends no_change when the subject is the cheapest", () => {
  const input: CostAnalysisInput = {
    capabilities: [cap("p1", "cheap", 1, 1), cap("p2", "pricey", 50, 50)],
    observations: [obs("p1", "cheap", 1, 1_000_000)],
  };
  const e = engineWith(enabled());
  const r = e.engine.recommend(input)[0]!;
  assert.equal(r.action, "no_change");
  assert.equal(r.alternative, null);
});

// ── Quality / health gating of alternatives ──────────────────────────────────

test("a cheaper alternative that is unavailable (health) is not recommended", () => {
  const health: ProviderHealthSnapshot[] = [
    { provider: "p2", model: "cheap", status: "unavailable", availability: 0, latencyMs: 0, timeoutRate: 1, errorRate: 1, retrySuccessRate: 0, circuitState: "open", fallbackFrequency: 0, healthScore: 0, lastUpdated: 0 },
  ];
  const input: CostAnalysisInput = {
    capabilities: [cap("p1", "expensive", 20, 40), cap("p2", "cheap", 2, 4)],
    observations: [obs("p1", "expensive", 1, 1_000_000)],
    health,
  };
  const r = engineWith(enabled()).engine.recommend(input)[0]!;
  assert.equal(r.action, "no_change", "an unavailable alternative is excluded");
});

// ── Immutability + advisory ──────────────────────────────────────────────────

test("produced CostRecommendations are immutable and advisory", () => {
  const input: CostAnalysisInput = { capabilities: [cap("p1", "m", 1, 1)], observations: [obs("p1", "m", 1, 1_000_000)] };
  const r = engineWith(enabled()).engine.recommend(input)[0]!;
  assert.equal(r.advisory, true);
  assert.equal(Object.isFrozen(r), true);
  assert.throws(() => { (r as { action: string }).action = "switch_model"; }, TypeError);
});

// ── Read-only consumption ────────────────────────────────────────────────────

test("recommending does not mutate the consumed inputs", () => {
  const input: CostAnalysisInput = {
    capabilities: [cap("p1", "expensive", 20, 40), cap("p2", "cheap", 2, 4)],
    observations: [obs("p1", "expensive", 1, 1_000_000)],
  };
  const snapshot = JSON.stringify(input);
  engineWith(enabled()).engine.recommend(input);
  assert.equal(JSON.stringify(input), snapshot, "consumed capabilities/observations are unchanged");
});

// ── Taxonomy: base Recommendation reused ─────────────────────────────────────

test("CostRecommendation is a specialization of the base Recommendation contract", () => {
  const input: CostAnalysisInput = { capabilities: [cap("p1", "m", 1, 1)], observations: [obs("p1", "m", 1, 1_000_000)] };
  const e = engineWith(enabled());
  e.engine.recommend(input);
  // Stored under the canonical taxonomy, retrievable as a base Recommendation.
  const base = e.store.byKind("cost");
  assert.equal(base.length, 1);
  assert.equal(base[0]!.kind, "cost");
  assert.ok("recommendationId" in base[0]! && "rationale" in base[0]! && "confidence" in base[0]!);
  assert.equal(e.store.costRecommendations().length, 1);
});

// ── Abstract Recommendation contract is shared, not IOS-019-owned ────────────

test("the abstract Recommendation contract lives in the shared taxonomy module", async () => {
  // The base taxonomy (Recommendation/RecommendationKind/RecommendationSubject) is
  // importable from the shared contract module — it is not owned by IOS-019.
  const contract = await import("@/lib/aiops/recommendation/recommendation-contract");
  assert.equal(typeof contract.recommendationKey, "function");
  assert.equal(contract.recommendationKey("p", "m"), "p|m");

  // CostRecommendation (IOS-019's concrete specialization) extends the base
  // contract: a produced cost recommendation carries the base fields and kind.
  const input: CostAnalysisInput = { capabilities: [cap("p1", "m", 1, 1)], observations: [obs("p1", "m", 1, 1_000_000)] };
  const r = engineWith(enabled()).engine.recommend(input)[0]!;
  assert.equal(r.kind, "cost");
  for (const f of ["recommendationId", "kind", "subject", "rationale", "confidence", "createdAt", "advisory"]) {
    assert.ok(f in r, `base contract field "${f}" present`);
  }
});

// ── Eligibility + disabled no-op ─────────────────────────────────────────────

test("ineligible providers are not analyzed", () => {
  const input: CostAnalysisInput = { capabilities: [cap("p1", "m", 1, 1)], observations: [obs("p1", "m", 1, 1_000_000)] };
  const recs = engineWith(enabled({ eligibleProviders: ["other"] })).engine.recommend(input);
  assert.deepEqual(recs, []);
});

test("a disabled policy is a no-op", () => {
  const input: CostAnalysisInput = { capabilities: [cap("p1", "m", 1, 1)], observations: [obs("p1", "m", 1, 1_000_000)] };
  assert.deepEqual(engineWith(defaultCostOptimizationPolicy()).engine.recommend(input), []);
});
