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
objects. It establishes the canonical **Recommendation** object family and becomes
the canonical producer of its first specialization, CostRecommendation.

## Scope

Governs the base `Recommendation` contract, the `CostRecommendation` specialization,
the cost analyzer, the recommendation store, and the CostOptimizationPolicy. It
does NOT introduce a generic recommendation engine and does NOT implement the
future specializations (SLARecommendation, RoutingRecommendation,
ProviderRecommendation, CapacityRecommendation, PolicyRecommendation) — each future
specification SHALL own only its specialization while reusing the base contract.
Out of scope: routing, provider invocation, execution authorization, and automatic
application of recommendations.

## Recommendation Taxonomy

IOS-019 defines the single platform-wide recommendation taxonomy:

- **Recommendation** — base canonical contract (recommendationId, kind, subject,
  rationale, confidence, createdAt, advisory). Every specialization extends it.
- **CostRecommendation** — first specialization (kind `cost`): observed/published
  cost per 1M tokens, an action (no_change / switch_model / reduce_usage /
  investigate), an optional cheaper no-worse alternative, and projected savings.

Future specializations (sla, routing, provider, capacity, policy) reuse the base
contract; IOS-019 does not implement them.

## Responsibilities

- Group cost observations per model target; compare published pricing (IOS-018)
  against alternatives that are no worse on benchmark (IOS-014) and evaluation
  (IOS-017) and not unavailable on health (IOS-013).
- Produce immutable, deterministic CostRecommendation objects; record them in the
  recommendation store under the canonical taxonomy.

## Public Interfaces

- `Recommendation`, `CostRecommendation`, `RecommendationKind`,
  `RecommendationSubject`.
- `CostOptimizationEngine.recommend(input)`; `analyzeCost(...)` (deterministic).
- `CostOptimizationPolicy` / `CostOptimizationPolicyStore`; `RecommendationStore`
  (`byKind`, `costRecommendations`, `all`).

## Canonical Object Contract

- **Canonical Objects Consumed** (read by reference, never mutated): ModelCapability
  / model metadata (IOS-018), execution history (cost observations assembled from
  IOS-004/005 execution outcomes), BenchmarkResult (IOS-014),
  ProviderHealthSnapshot (IOS-013), EvaluationResult (IOS-017).
- **Canonical Objects Produced**: the base **Recommendation** contract and its
  first specialization **CostRecommendation** — IOS-019 is the canonical producer
  of CostRecommendation.
- **Existing Contracts Reused**: IOS-018 published metadata contracts; IOS-013/014/
  017 observation objects.
- **Authoritative Producers** (of consumed objects): IOS-018 owns model metadata;
  IOS-013 owns ProviderHealthSnapshot; IOS-014 owns BenchmarkResult; IOS-017 owns
  EvaluationResult; the Execution Pipeline (IOS-004/005) owns execution history.
  This engine SHALL NOT mutate any of them.
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

- `src/lib/aiops/recommendation/*` (recommendation-types, cost-analyzer,
  recommendation-store, cost-engine, cost-bootstrap); consumes
  `src/lib/aiops/capability` (IOS-018) and IOS-013/014/017 objects; installed in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/cost-optimization-engine.test.ts`.
