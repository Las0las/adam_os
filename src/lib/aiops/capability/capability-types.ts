// IOS-018 — Model Capability Registry (per AS-001) — types.
//
// IOS-018 IMPLEMENTS and operationalizes the IOS-002 Model Capability Registry
// contract (it does NOT supersede it: IOS-002 remains the normative architectural
// definition). It is the CANONICAL METADATA AUTHORITY for models — the
// authoritative producer of ModelDescriptor, ModelCapability, ModelLimits,
// ModelFeatures, ModelPricingMetadata, ModelLifecycleState, and
// ModelPublisherMetadata — derived declaratively from published provider
// declarations and optionally enriched with benchmark/evaluation observations. It
// is declarative only: it SHALL NOT route, execute providers, authorize execution,
// evaluate models, or calculate health. Governed Routing and all other consumers
// read published metadata through these contracts.

import { capabilitySetOf, type CapabilitySet, type ModelDescriptor, type ModelPricing } from "@/lib/aiops/providers/provider-registry-types";

// Re-export the IOS-002 canonical contracts this registry reuses (it does not
// redefine them).
export type { CapabilitySet, ModelDescriptor, ModelPricing };

// ── Canonical metadata facets (IOS-018 is their authoritative producer) ───────

/** Operational limits for a model. */
export interface ModelLimits {
  contextWindow: number;
}
/** Capability/feature flags for a model (the published feature set). */
export type ModelFeatures = CapabilitySet;
/** Published pricing metadata (null when the provider publishes none). */
export interface ModelPricingMetadata {
  pricing: ModelPricing | null;
}
/** Declarative lifecycle state derived from the published declaration. */
export type ModelLifecycleState = "active" | "deprecated";
/** Publisher/provenance metadata. */
export interface ModelPublisherMetadata {
  publisher: string;
  family: string;
}

/** Optional, declarative observation summaries (do not influence routing). */
export interface CapabilityBenchmarkSummary {
  runs: number;
  averageScore: number;
}
export interface CapabilityEvaluationSummary {
  reports: number;
  passRate: number;
}

/** The canonical capability record for one provider+model. Immutable on publish.
 *  It carries every published metadata facet so consumers (routing, evaluation,
 *  benchmarking, explainability, health, cost optimization, SLA, adaptive routing)
 *  read model metadata from one canonical source. */
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
  /** Canonical metadata facets (authoritatively produced by IOS-018). */
  limits: ModelLimits;
  features: ModelFeatures;
  pricingMetadata: ModelPricingMetadata;
  lifecycle: ModelLifecycleState;
  publisherMetadata: ModelPublisherMetadata;
  /** Declarative benchmark observation (IOS-014), or null. */
  benchmark: CapabilityBenchmarkSummary | null;
  /** Declarative evaluation observation (IOS-017), or null. */
  evaluation: CapabilityEvaluationSummary | null;
}

/** Canonical identity for a capability record: one per provider + model. */
export function capabilityKey(provider: string, model: string): string {
  return `${provider}|${model}`;
}

/** Derive a base ModelCapability (with all metadata facets) from a published
 *  ModelDescriptor (IOS-002). */
export function deriveCapability(d: ModelDescriptor): ModelCapability {
  const features = capabilitySetOf(d);
  return {
    provider: d.provider,
    model: d.model,
    publisher: d.publisher,
    family: d.family,
    version: d.version,
    contextWindow: d.contextWindow,
    capabilities: features,
    pricing: d.pricing,
    deprecated: d.deprecated,
    limits: { contextWindow: d.contextWindow },
    features,
    pricingMetadata: { pricing: d.pricing },
    lifecycle: d.deprecated ? "deprecated" : "active",
    publisherMetadata: { publisher: d.publisher, family: d.family },
    benchmark: null,
    evaluation: null,
  };
}
