# IOS-020 — SLA Management

| Field | Value |
|-------|-------|
| Identifier | IOS-020 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-013, IOS-014, IOS-017, IOS-018, IOS-019, ADR-0001 |

## Purpose

The SLA Management Engine SHALL be a purely ADVISORY subsystem. It consumes
published model metadata (IOS-018), execution history, provider health (IOS-013),
evaluation results (IOS-017), benchmark results (IOS-014), and the abstract
**Recommendation** contract, and produces immutable **SLARecommendation** objects.
IOS-020 is the canonical producer of **SLARecommendation only**; it does NOT own the
Recommendation hierarchy.

## Scope

Governs the `SLARecommendation` specialization, the SLA analyzer, and the SLAPolicy
(objective + eligibility). The base `Recommendation` contract is **abstract and
shared** (taxonomy v1.0, owned by no single specification); the recommendation store
is shared taxonomy infrastructure. IOS-020 does NOT introduce a generic
recommendation engine and does NOT implement other specializations
(CostRecommendation belongs to IOS-019; ProviderRecommendation,
CapacityRecommendation, PolicyRecommendation, RoutingRecommendation,
SchedulingRecommendation, OptimizationRecommendation are reserved for future
specifications). Out of scope: routing, provider invocation, execution
authorization, SLA enforcement, and automatic application of recommendations.

## Recommendation Taxonomy v1.0 (FROZEN)

IOS-020 consumes the FROZEN taxonomy established by IOS-019. **Recommendation** is a
**Shared Canonical Contract** — abstract, reusable, NEVER directly produced, with NO
canonical producer. It defines ONLY the common semantics shared by all
recommendations (no domain-specific fields): recommendationId, recommendationType,
priority, confidence, rationale, evidenceReferences, estimatedImpact, estimatedCost,
estimatedBenefit, createdAt, producerSpecification, recommendationStatus.

**SLARecommendation** is a **Canonical Object** — a concrete realization extending
Recommendation, owned and produced by exactly one specification (IOS-020). It adds:
subject (provider+model), objective (target availability / max latency / max error
rate), observed (availability/latency/errorRate), breached, breachedDimensions, and
action (no_change / investigate / mitigate / escalate). IOS-020 SHALL NOT redefine
the base contract; taxonomy v1.0 remains FROZEN.

## Responsibilities

- Evaluate each provider-health subject (IOS-013) against the SLA objective across
  availability, latency, and error-rate dimensions.
- Derive deterministic severity (no_change / investigate / mitigate / escalate) and
  priority from the breached dimensions and observed health status.
- Produce immutable, deterministic SLARecommendation objects; record them in the
  recommendation store under the canonical taxonomy.

## Public Interfaces

- `Recommendation` (abstract, shared — `recommendation-contract.ts`),
  `RecommendationSubject`; `SLARecommendation`, `SLAObjective`, `SLAAction`
  (IOS-020).
- `SLAManagementEngine.recommend(input)`; `analyzeSLA(...)` (deterministic).
- `SLAPolicy` / `SLAPolicyStore`; `RecommendationStore` (`byType`, `all`).

## Canonical Object Contract

- **Canonical Objects Consumed** (read by reference, never mutated): **ModelDescriptor**,
  **ModelCapability**, **ModelLimits**, **ModelFeatures**, **ModelPricingMetadata**,
  **ModelLifecycleState**, **ModelPublisherMetadata** (all IOS-018);
  **ProviderHealthSnapshot** (IOS-013, the primary SLA signal); **EvaluationResult**
  (IOS-017); **BenchmarkResult** (IOS-014); **ExecutionHistory** (IOS-004/005
  execution outcomes); and the abstract **Recommendation** contract (shared
  taxonomy).
- **Canonical Objects Produced**: **SLARecommendation** only — IOS-020 is its
  canonical producer. (The abstract `Recommendation` base contract is shared,
  taxonomy-level, and NOT owned by IOS-020.)
- **Existing Contracts Reused**: the abstract `Recommendation` taxonomy contract;
  IOS-018 published metadata contracts; IOS-013/014/017 observation objects.
- **Authoritative Producers** (of consumed objects): IOS-018 owns all model metadata
  (ModelDescriptor/Capability/Limits/Features/PricingMetadata/LifecycleState/
  PublisherMetadata); IOS-013 owns ProviderHealthSnapshot; IOS-014 owns
  BenchmarkResult; IOS-017 owns EvaluationResult; the Execution Pipeline (IOS-004/
  005) owns ExecutionHistory. Authority for every consumed object remains with its
  respective producing specification; this engine SHALL NOT mutate any of them.
- **Authorized Consumers** (of produced objects): operator/SRE/reliability surfaces
  and other advisory consumers MAY read SLARecommendation. Routing SHALL NOT consume
  it to make automatic decisions — recommendations are advisory. Consumers SHALL NOT
  mutate published recommendations.

## Invariants

- The engine SHALL be purely advisory: it SHALL NOT perform routing, authorize
  execution targets, invoke providers, enforce SLAs, or apply recommendations
  automatically.
- SLARecommendation objects SHALL be immutable and carry `producerSpecification`
  "IOS-020" and `recommendationStatus` "proposed" on production.
- The engine SHALL NOT mutate any consumed canonical object.
- Analysis SHALL be deterministic; default policy DISABLED.

## Dependencies

- IOS-013 (provider health), IOS-018 (metadata), IOS-014/017 (observations), IOS-019
  (recommendation taxonomy); conforms to IOS-003 (routing unaffected) · AS-001 ·
  Constitution v1.0.

## Conformance Requirements

1. A subject below the availability target while observed `unavailable` SHALL yield
   an `escalate` / `critical` SLARecommendation.
2. A subject breaching two or more objective dimensions SHALL yield `mitigate` /
   `high`; a single breached dimension SHALL yield `investigate` / `medium`.
3. A subject meeting the objective SHALL yield `no_change` / `low` with no breached
   dimensions.
4. Analysis SHALL be deterministic for identical inputs.

### Canonical Object Contract conformance (mandatory)

5. **Read-only consumption** — recommending SHALL NOT mutate the consumed provider
   health snapshots or any other consumed input.
6. **Exclusive production** — SLARecommendation SHALL be produced ONLY by this engine
   and SHALL be immutable; it SHALL carry `producerSpecification` "IOS-020".
7. **No authority inversion** — the engine SHALL NOT route, authorize, invoke, or
   enforce; producing a recommendation confers no execution/routing authority.
8. **Dependency direction (AS-001)** — it SHALL depend only on IOS-013/014/017/018
   objects and the shared Recommendation taxonomy; routing (IOS-003) SHALL NOT depend
   on it.
9. **No mutation of unowned objects** — it SHALL NOT mutate ProviderHealthSnapshot,
   ModelCapability, BenchmarkResult, EvaluationResult, execution history, or the
   abstract Recommendation contract.

## Related ADRs

- ADR-0001 (governance framework). (No new ADR: implemented through published
  IOS-013/014/017/018/019 contracts.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/sla/*` (sla-types — SLARecommendation/SLAObjective/SLAPolicy;
  sla-analyzer — deterministic SLA analysis; sla-engine, sla-bootstrap); reuses
  `src/lib/aiops/recommendation/*` (the abstract shared taxonomy + store); consumes
  `src/lib/aiops/health` (IOS-013) and IOS-014/017/018 objects; installed in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/sla-management-engine.test.ts`.
