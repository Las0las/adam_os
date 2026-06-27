// IOS-018 — Model Capability Registry (per AS-001) — types.
//
// IOS-018 IMPLEMENTS and operationalizes the IOS-002 Model Capability Registry
// contract (it does NOT supersede it: IOS-002 remains the normative architectural
// definition). It is the canonical PRODUCER of ModelCapability and ModelDescriptor
// metadata, derived declaratively from published provider declarations and
// optionally enriched with benchmark/evaluation observations. It is declarative
// and observational: it SHALL NOT influence routing. Governed Routing continues to
// consume published capability metadata through the existing IOS-001/002 contracts.

import { capabilitySetOf, type CapabilitySet, type ModelDescriptor, type ModelPricing } from "@/lib/aiops/providers/provider-registry-types";

// Re-export the IOS-002 canonical contracts this registry reuses (it does not
// redefine them).
export type { CapabilitySet, ModelDescriptor, ModelPricing };

/** Optional, declarative observation summaries (do not influence routing). */
export interface CapabilityBenchmarkSummary {
  runs: number;
  averageScore: number;
}
export interface CapabilityEvaluationSummary {
  reports: number;
  passRate: number;
}

/** The canonical capability record for one provider+model. Immutable on publish. */
export interface ModelCapability {
  provider: string;
  model: string;
  publisher: string;
  family: string;
  version: string | null;
  contextWindow: number;
  capabilities: CapabilitySet;
  pricing: ModelPricing | null;
  deprecated: boolean;
  /** Declarative benchmark observation (IOS-014), or null. */
  benchmark: CapabilityBenchmarkSummary | null;
  /** Declarative evaluation observation (IOS-017), or null. */
  evaluation: CapabilityEvaluationSummary | null;
}

/** Canonical identity for a capability record: one per provider + model. */
export function capabilityKey(provider: string, model: string): string {
  return `${provider}|${model}`;
}

/** Derive a base ModelCapability from a published ModelDescriptor (IOS-002). */
export function deriveCapability(d: ModelDescriptor): ModelCapability {
  return {
    provider: d.provider,
    model: d.model,
    publisher: d.publisher,
    family: d.family,
    version: d.version,
    contextWindow: d.contextWindow,
    capabilities: capabilitySetOf(d),
    pricing: d.pricing,
    deprecated: d.deprecated,
    benchmark: null,
    evaluation: null,
  };
}
