# IOS-019 — Cost Optimization Engine

| Field | Value |
|-------|-------|
| Identifier | IOS-019 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-013, IOS-014, IOS-017, IOS-018, ADR-0001 |

## Purpose

The Cost Optimization Engine SHALL be a purely ADVISORY subsystem. It consumes
published model metadata (IOS-018), execution history, benchmark results, provider
health, and evaluation results, and produces immutable **CostRecommendation**
objects. IOS-019 is the canonical producer of **CostRecommendation only**; it does
NOT own the Recommendation hierarchy.

## Scope

Governs the `CostRecommendation` specialization, the cost analyzer, and the
CostOptimizationPolicy. The base `Recommendation` contract is **abstract and
shared** (taxonomy-level, not owned by IOS-019); the recommendation store is shared
taxonomy infrastructure. IOS-019 does NOT introduce a generic recommendation engine
and does NOT implement the future specializations (SLARecommendation,
RoutingRecommendation, ProviderRecommendation, CapacityRecommendation,
PolicyRecommendation) — each future specification SHALL own only its specialization
while reusing the abstract contract. Out of scope: routing, provider invocation,
execution authorization, and automatic application of recommendations.

## Recommendation Taxonomy v1.0 (FROZEN)

A single platform-wide recommendation taxonomy, with ownership boundaries.

**Recommendation** is a **Shared Canonical Contract** — an abstract, reusable
object taxonomy that is NEVER directly produced and has NO canonical producer. It
defines ONLY the common semantics shared by all recommendations (no domain-specific
fields):

- recommendationId, recommendationType, priority, confidence, rationale,
  evidenceReferences, estimatedImpact, estimatedCost, estimatedBenefit, createdAt,
  producerSpecification, recommendationStatus.

Concrete recommendation types are **Canonical Objects**, each extending
Recommendation and owned/produced by exactly one specification:

- **CostRecommendation** → IOS-019 (implemented). Adds: subject, observed/published
  cost per 1M tokens, action (no_change / switch_model / reduce_usage /
  investigate), an optional cheaper no-worse alternative, projected savings.
- Reserved: **SLARecommendation** → IOS-020; and **ProviderRecommendation**,
  **CapacityRecommendation**, **PolicyRecommendation**, **RoutingRecommendation**,
  **SchedulingRecommendation**, **OptimizationRecommendation** → future
  specifications.

No future specification SHALL redefine the Recommendation base contract; taxonomy
v1.0 is FROZEN. Each future specification owns only its concrete specialization.

## Responsibilities

- Group cost observations per model target; compare published pricing (IOS-018)
  against alternatives that are no worse on benchmark (IOS-014) and evaluation
  (IOS-017) and not unavailable on health (IOS-013).
- Produce immutable, deterministic CostRecommendation objects; record them in the
  recommendation store under the canonical taxonomy.

## Public Interfaces

- `Recommendation` (abstract, shared — `recommendation-contract.ts`),
  `RecommendationKind`, `RecommendationSubject`; `CostRecommendation` (IOS-019).
- `CostOptimizationEngine.recommend(input)`; `analyzeCost(...)` (deterministic).
- `CostOptimizationPolicy` / `CostOptimizationPolicyStore`; `RecommendationStore`
  (`byKind`, `costRecommendations`, `all`).

## Canonical Object Contract

- **Canonical Objects Consumed** (read by reference, never mutated): **ModelDescriptor**,
  **ModelCapability**, **ModelLimits**, **ModelFeatures**, **ModelPricingMetadata**,
  **ModelLifecycleState**, **ModelPublisherMetadata** (all IOS-018);
  **ProviderHealthSnapshot** (IOS-013); **EvaluationResult** (IOS-017);
  **BenchmarkResult** (IOS-014); **ExecutionHistory** (cost observations assembled
  from IOS-004/005 execution outcomes).
- **Canonical Objects Produced**: **CostRecommendation** only — IOS-019 is its
  canonical producer. (The abstract `Recommendation` base contract is shared,
  taxonomy-level, and NOT owned by IOS-019.)
- **Existing Contracts Reused**: the abstract `Recommendation` taxonomy contract;
  IOS-018 published metadata contracts; IOS-013/014/017 observation objects.
- **Authoritative Producers** (of consumed objects): IOS-018 owns all model metadata
  (ModelDescriptor/Capability/Limits/Features/PricingMetadata/LifecycleState/
  PublisherMetadata); IOS-013 owns ProviderHealthSnapshot; IOS-014 owns
  BenchmarkResult; IOS-017 owns EvaluationResult; the Execution Pipeline (IOS-004/
  005) owns ExecutionHistory. Authority for every consumed object remains with its
  respective producing specification; this engine SHALL NOT mutate any of them.
- **Authorized Consumers** (of produced objects): operator/FinOps surfaces, SLA
  Management, and other advisory consumers MAY read CostRecommendation. Routing
  SHALL NOT consume it to make automatic decisions — recommendations are advisory.
  Consumers SHALL NOT mutate published recommendations.

## Invariants

- The engine SHALL be purely advisory: it SHALL NOT influence routing, authorize
  execution targets, invoke providers, or apply recommendations automatically.
- CostRecommendation objects SHALL be immutable and SHALL carry `advisory: true`.
- The engine SHALL NOT mutate any consumed canonical object.
- Analysis SHALL be deterministic; default policy DISABLED.

## Dependencies

- IOS-018 (metadata), IOS-013/014/017 (observations); conforms to IOS-003 (routing
  unaffected) · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A cheaper, no-worse alternative SHALL yield a `switch_model` CostRecommendation
   with the alternative and projected savings.
2. A cost-competitive subject SHALL yield `no_change`.
3. An alternative that is unavailable (health) or worse on benchmark/evaluation
   SHALL NOT be recommended.
4. Analysis SHALL be deterministic for identical inputs.

### Canonical Object Contract conformance (mandatory)

5. **Read-only consumption** — recommending SHALL NOT mutate the consumed
   capabilities, observations, benchmark/health/evaluation inputs.
6. **Exclusive production** — CostRecommendation SHALL be produced ONLY by this
   engine and SHALL be immutable; it SHALL carry `advisory: true`.
7. **No authority inversion** — the engine SHALL NOT route, authorize, or invoke;
   producing a recommendation confers no execution/routing authority.
8. **Dependency direction (AS-001)** — it SHALL depend only on IOS-018 metadata and
   IOS-013/014/017 observations; routing (IOS-003) SHALL NOT depend on it.
9. **No mutation of unowned objects** — it SHALL NOT mutate ModelCapability,
   BenchmarkResult, ProviderHealthSnapshot, EvaluationResult, or execution history.

## Related ADRs

- ADR-0001 (governance framework). (No new ADR: implemented through published
  IOS-013/014/017/018 contracts.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/recommendation/*` (recommendation-contract — the abstract shared
  taxonomy; recommendation-types — CostRecommendation; cost-analyzer,
  recommendation-store, cost-engine, cost-bootstrap); consumes
  `src/lib/aiops/capability` (IOS-018) and IOS-013/014/017 objects; installed in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/cost-optimization-engine.test.ts`.
