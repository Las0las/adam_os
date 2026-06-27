# IOS-015 — Explainability Engine

| Field | Value |
|-------|-------|
| Identifier | IOS-015 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-005, IOS-006, IOS-007, IOS-010, IOS-011, IOS-012, IOS-013, IOS-014, ADR-0001, ADR-0004, DD-001 |

## Purpose

The Explainability Engine SHALL produce immutable, structured Explanations of why
each execution behaved as it did — the routing decision and authorized Execution
Plan, which middleware acted (security, cache, retry, circuit, fallback), the
provider-health reference, and the outcome. It is observational: it only correlates,
records, publishes, and exposes explanations.

## Scope

Governs ExplainabilityEngine, the Explanation record, the Explanation store,
explanation events, ExplainabilityPolicy, and explainability metrics. Out of scope
(future specifications): LLM-based narration, drift detection, evaluation scoring,
adaptive routing, dashboards, and persistence beyond the in-memory store.

## Architectural Placement

A PURELY OBSERVATIONAL subscriber on the Execution Event Bus (IOS-005) — it
registers NO execution hook and changes no execution behavior:

```
Execution Pipeline → Execution Event Bus → Explainability Engine →
  Explanation Store → Consumers (audit, surfaces, SLA Manager, …)
```

## Responsibilities

- Correlate the events of a single execution (by executionId), from
  `execution.started` to the terminal `execution.completed`/`failed`.
- Read the canonical objects WITHOUT mutating them: the RoutingDecision /
  Execution Plan carried on the execution event, and the IOS-013 ProviderHealth
  store by reference.
- Finalize an immutable Explanation, store it (bounded), and publish
  `explanation.produced`. Collect passive metrics.

## Explanation

`Explanation` (immutable; frozen on production): executionId, requestId, tenantId,
provider, model, workloadType, timestamp; `routing` (selectedProvider/Model, plan
targets, evaluatedProviders, rejections); `security` (inspected, promptOutcome,
piiDetected, piiMasked, validation); `cache` (lookedUp, hit); `retry` (attempts,
outcome); `circuit` (state, rejected); `fallback` (occurred, target); `healthRef`
(the `provider|model` key into the IOS-013 ProviderHealth store); `outcome`
(success, errorKind, latencyMs).

## Explainability Policy

`ExplainabilityPolicy` (immutable): mode (enabled/disabled), eligibleProviders,
eligibleWorkloads, retain (bounded store size). The default policy is DISABLED.

## Events

Immutable event on the Execution Event Bus: `explanation.produced` (carries the
Explanation); `isExplanationEvent`. The engine IGNORES its own `explanation.*`
events (no recursion).

## Metrics

Passive metrics: explanations produced, successes/failures, with-retry,
with-fallback, cache hits, security rejections. No dashboards; no persistence
beyond the Explanation store.

## Invariants

- The engine SHALL preserve execution identity, Execution Plan immutability,
  RoutingDecision immutability, middleware ordering, and deterministic execution.
- The engine SHALL NOT perform routing, authorize execution targets, modify
  Execution Plans, invoke providers, retry, or trigger fallback.
- Explanations SHALL be immutable; consumers READ them and SHALL NOT mutate them.
- Explainability is observational; execution and routing remain authoritative.

## Dependencies

- IOS-005 (event bus); observes IOS-004/006/007/010/011/012 events; references the
  IOS-013 ProviderHealth store and the ADR-0004 Execution Plan; conforms to
  IOS-003, IOS-008, IOS-009, IOS-014 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. An execution's events SHALL be correlated into a complete Explanation (routing,
   security, cache, retry, circuit, fallback, health reference, outcome).
2. A failed execution SHALL record outcome success=false and the error kind.
3. Intermediate events with no started window SHALL NOT produce an Explanation.
4. Produced Explanations SHALL be immutable.
5. Production SHALL be deterministic for an identical event sequence.
6. Each finalized Explanation SHALL publish `explanation.produced` and fold into
   metrics.
7. The engine SHALL ignore its own `explanation.*` events.
8. The store SHALL be bounded by the retention policy.
9. A disabled policy (and ineligible providers/workloads) SHALL be a no-op; all
   existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0001 (governance framework); ADR-0004 (Execution Plan — referenced).
  (No new ADR: implemented entirely through the published IOS-005 subscriber
  contract and the canonical platform objects.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/explainability/*` (explainability-types, explanation-store,
  explainability-events, explainability-engine, explainability-metrics,
  explainability-bootstrap); subscribes to the IOS-005 bus; wired in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/explainability-engine.test.ts`.
