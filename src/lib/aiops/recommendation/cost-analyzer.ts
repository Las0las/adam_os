// IOS-019 — Cost Optimization Engine — deterministic cost analysis.
//
// Pure: given published capability metadata (IOS-018), cost observations, and
// optional benchmark/health/evaluation evidence, produce deterministic
// CostRecommendation objects. It reads all inputs BY REFERENCE and mutates none.
// No randomness; ordering is total and stable.

import type { ModelCapability } from "@/lib/aiops/capability/capability-types";
import type { BenchmarkResult } from "@/lib/aiops/benchmark/benchmark-types";
import type { ProviderHealthSnapshot } from "@/lib/aiops/health/health-types";
import type { EvaluationResult } from "@/lib/aiops/evaluation/evaluation-types";
import {
  recommendationKey,
  type CostObservation,
  type CostOptimizationPolicy,
  type CostRecommendation,
  type RecommendationSubject,
} from "./recommendation-types";

export interface CostAnalysisInput {
  capabilities: ModelCapability[];
  observations: CostObservation[];
  benchmarks?: BenchmarkResult[];
  health?: ProviderHealthSnapshot[];
  evaluations?: EvaluationResult[];
}

/** Published blended price per 1M tokens, or null when pricing is unavailable. */
function pricedPerMTok(cap: ModelCapability | undefined): number | null {
  const p = cap?.pricingMetadata.pricing;
  return p ? (p.inputPerMTok + p.outputPerMTok) / 2 : null;
}

function meanBenchmark(results: BenchmarkResult[] | undefined, key: string): number | null {
  if (!results) return null;
  const xs = results.filter((r) => recommendationKey(r.provider, r.model) === key);
  if (xs.length === 0) return null;
  return xs.reduce((a, r) => a + r.normalizedScore, 0) / xs.length;
}

function meanEvaluation(results: EvaluationResult[] | undefined, key: string): number | null {
  if (!results) return null;
  const xs = results.filter((r) => recommendationKey(r.provider, r.model) === key);
  if (xs.length === 0) return null;
  return xs.reduce((a, r) => a + r.score, 0) / xs.length;
}

function healthStatus(health: ProviderHealthSnapshot[] | undefined, key: string): string {
  if (!health) return "unknown";
  const h = health.find((s) => recommendationKey(s.provider, s.model) === key);
  return h?.status ?? "unknown";
}

/** Deterministic. Returns one CostRecommendation per eligible observed subject. */
export function analyzeCost(
  input: CostAnalysisInput,
  policy: CostOptimizationPolicy,
  now: () => number,
  idFor: (subjectKey: string) => string,
): CostRecommendation[] {
  // Group observations per subject (provider|model).
  const groups = new Map<string, { provider: string; model: string; cost: number; tokens: number; count: number }>();
  for (const o of input.observations) {
    if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(o.provider)) continue;
    const key = recommendationKey(o.provider, o.model);
    const g = groups.get(key) ?? { provider: o.provider, model: o.model, cost: 0, tokens: 0, count: 0 };
    g.cost += o.costUsd;
    g.tokens += o.totalTokens;
    g.count += 1;
    groups.set(key, g);
  }

  const capByKey = new Map(input.capabilities.map((c) => [recommendationKey(c.provider, c.model), c]));
  const out: CostRecommendation[] = [];

  // Stable iteration order.
  for (const key of [...groups.keys()].sort()) {
    const g = groups.get(key)!;
    if (g.count < Math.max(1, policy.minObservations)) continue;

    const subjectCap = capByKey.get(key);
    const observedCostPerMTok = g.tokens > 0 ? (g.cost / g.tokens) * 1_000_000 : null;
    const pricedCostPerMTok = pricedPerMTok(subjectCap);
    const subjectBench = meanBenchmark(input.benchmarks, key);
    const subjectEval = meanEvaluation(input.evaluations, key);

    // Candidate cheaper alternatives that are no worse on quality and healthy.
    let best: { subject: RecommendationSubject; price: number } | null = null;
    for (const cap of input.capabilities) {
      const candKey = recommendationKey(cap.provider, cap.model);
      if (candKey === key) continue;
      const candPrice = pricedPerMTok(cap);
      if (candPrice == null) continue;
      if (pricedCostPerMTok != null && candPrice >= pricedCostPerMTok) continue; // not cheaper
      if (healthStatus(input.health, candKey) === "unavailable") continue;
      const candBench = meanBenchmark(input.benchmarks, candKey);
      if (subjectBench != null && candBench != null && candBench < subjectBench) continue;
      const candEval = meanEvaluation(input.evaluations, candKey);
      if (subjectEval != null && candEval != null && candEval < subjectEval) continue;
      // Pick the cheapest; tie-break by key for determinism.
      if (!best || candPrice < best.price || (candPrice === best.price && candKey < recommendationKey(best.subject.provider, best.subject.model))) {
        best = { subject: { provider: cap.provider, model: cap.model }, price: candPrice };
      }
    }

    let action: CostRecommendation["action"] = "no_change";
    let projectedSavingsPct: number | null = null;
    let alternative: CostRecommendation["alternative"] = null;
    let rationale = "subject is cost-competitive among eligible alternatives";
    let estimatedBenefit: number | null = null;

    if (best && pricedCostPerMTok != null && pricedCostPerMTok > 0) {
      projectedSavingsPct = ((pricedCostPerMTok - best.price) / pricedCostPerMTok) * 100;
      if (projectedSavingsPct >= policy.savingsThresholdPct) {
        action = "switch_model";
        alternative = { provider: best.subject.provider, model: best.subject.model, pricedCostPerMTok: best.price };
        estimatedBenefit = pricedCostPerMTok - best.price; // savings per 1M tokens
        rationale = `a cheaper, no-worse alternative is available (~${projectedSavingsPct.toFixed(1)}% lower published price)`;
      }
    } else if (pricedCostPerMTok == null && observedCostPerMTok != null) {
      action = "investigate";
      rationale = "subject has observed cost but no published pricing metadata";
    }

    // Confidence: more evidence → higher confidence (deterministic).
    let confidence = 0.5;
    if (subjectBench != null) confidence += 0.2;
    if (subjectEval != null) confidence += 0.2;
    if (pricedCostPerMTok != null) confidence += 0.1;
    confidence = Math.min(1, confidence);

    // Priority derives from the recommendation strength (deterministic).
    const priority =
      action === "switch_model"
        ? ((projectedSavingsPct ?? 0) >= 50 ? "high" : "medium")
        : action === "investigate" ? "medium" : "low";

    // Evidence references (by key — never embedded copies).
    const evidenceReferences = [{ kind: "modelCapability", ref: key }, { kind: "executionHistory", ref: key }];
    if (subjectBench != null) evidenceReferences.push({ kind: "benchmark", ref: key });
    if (subjectEval != null) evidenceReferences.push({ kind: "evaluation", ref: key });
    if (input.health) evidenceReferences.push({ kind: "providerHealth", ref: key });

    out.push({
      recommendationId: idFor(key),
      recommendationType: "cost",
      priority,
      confidence,
      rationale,
      evidenceReferences,
      estimatedImpact: projectedSavingsPct != null ? Math.min(1, Math.max(0, projectedSavingsPct / 100)) : null,
      estimatedCost: pricedCostPerMTok,
      estimatedBenefit,
      createdAt: now(),
      producerSpecification: "IOS-019",
      recommendationStatus: "proposed",
      subject: { provider: g.provider, model: g.model },
      observedCostPerMTok,
      pricedCostPerMTok,
      action,
      alternative,
      projectedSavingsPct,
    });
  }
  return out;
}
