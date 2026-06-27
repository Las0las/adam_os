// IOS-020 — SLA Management — deterministic SLA analysis.
//
// Pure: given provider health (IOS-013) and the SLA objective, evaluate each
// subject against availability/latency/error-rate targets and produce deterministic
// SLARecommendation objects. Reads all inputs BY REFERENCE; mutates none.

import { recommendationKey } from "@/lib/aiops/recommendation/recommendation-contract";
import type { ProviderHealthSnapshot } from "@/lib/aiops/health/health-types";
import type { SLAPolicy, SLARecommendation } from "./sla-types";

export interface SLAAnalysisInput {
  /** Provider health snapshots (the primary SLA signal). */
  health: ProviderHealthSnapshot[];
}

/** Deterministic. One SLARecommendation per eligible health subject. */
export function analyzeSLA(
  input: SLAAnalysisInput,
  policy: SLAPolicy,
  now: () => number,
  idFor: (subjectKey: string) => string,
): SLARecommendation[] {
  const objective = policy.objective;
  const out: SLARecommendation[] = [];

  // Stable iteration order by subject key.
  const sorted = [...input.health].sort((a, b) =>
    recommendationKey(a.provider, a.model) < recommendationKey(b.provider, b.model) ? -1 : 1,
  );

  for (const h of sorted) {
    if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(h.provider)) continue;
    const key = recommendationKey(h.provider, h.model);

    const breachedDimensions: string[] = [];
    if (h.availability < objective.targetAvailability) breachedDimensions.push("availability");
    if (objective.maxLatencyMs != null && h.latencyMs > objective.maxLatencyMs) breachedDimensions.push("latency");
    if (objective.maxErrorRate != null && h.errorRate > objective.maxErrorRate) breachedDimensions.push("errorRate");
    const breached = breachedDimensions.length > 0;

    // Severity / action derive deterministically from the breach + health status.
    let action: SLARecommendation["action"] = "no_change";
    let priority: SLARecommendation["priority"] = "low";
    let rationale = "subject meets the SLA objective";
    if (breached) {
      if (h.status === "unavailable") { action = "escalate"; priority = "critical"; }
      else if (breachedDimensions.length >= 2) { action = "mitigate"; priority = "high"; }
      else { action = "investigate"; priority = "medium"; }
      rationale = `SLA breach on: ${breachedDimensions.join(", ")} (status ${h.status})`;
    }

    // Impact: shortfall in availability vs target (0..1), deterministic.
    const estimatedImpact = breached
      ? Math.min(1, Math.max(0, objective.targetAvailability - h.availability) + (breachedDimensions.length - 1) * 0.1)
      : 0;

    out.push({
      recommendationId: idFor(key),
      recommendationType: "sla",
      priority,
      confidence: 0.8, // health-derived; deterministic
      rationale,
      evidenceReferences: [{ kind: "providerHealth", ref: key }],
      estimatedImpact,
      estimatedCost: null,
      estimatedBenefit: null,
      createdAt: now(),
      producerSpecification: "IOS-020",
      recommendationStatus: "proposed",
      subject: { provider: h.provider, model: h.model },
      objective,
      observed: { availability: h.availability, latencyMs: h.latencyMs, errorRate: h.errorRate },
      breached,
      breachedDimensions,
      action,
    });
  }
  return out;
}
