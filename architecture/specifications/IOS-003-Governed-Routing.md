# IOS-003 — Governed Routing

| Field | Value |
|-------|-------|
| Identifier | IOS-003 |
| Version | 1.1 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-001, IOS-002, IOS-004, ADR-0001, ADR-0004 |

## Purpose

Governed Routing SHALL select a provider and model for a workload by evaluating
the Provider Registry against declared capabilities and a declarative policy,
producing an immutable, explainable RoutingDecision (Constitution, Articles III
and IV).

## Scope

Governs `RoutingRequest`, `RoutingPolicy`, capability resolution, and the routing
engine that yields a `RoutingDecision`. Excludes invocation (IOS-004). This
specification covers capability/policy-based selection only — no health, latency,
or cost scoring (deferred to a future specification + ADR).

## Responsibilities

- Accept a provider-independent `RoutingRequest` (workload, required
  capabilities, preferences, constraints, tenant).
- Apply a declarative `RoutingPolicy` (allow/deny/preferred providers, required
  capabilities/families, context-window bound, per-tenant overrides).
- Evaluate eligibility using ONLY declared capabilities and explicit policy.
- Return an immutable `RoutingDecision` recording the selection, evaluated
  providers, and deterministic rejection reasons.
- (v1.1, ADR-0004) Emit the immutable **Execution Plan** on the decision
  (`executionPlan`): the ordered, authorized execution targets (the surviving
  candidates in routing-preference order; `targets[0]` = the selected/primary).
  Routing is the SOLE authority that selects and authorizes invocation targets;
  the execution layer invokes only plan members and never authorizes or constructs
  targets.

## Public Interfaces

- `RoutingRequest`, `RoutingPolicy`, `RoutingRejection`, `RoutingDecision`.
- `route(request, policy, registry): RoutingDecision`.
- `impliedCapabilities`, `effectivePolicy`, `deepFreeze`.
- (v1.1) `ExecutionTarget`, `ExecutionPlan`, `RoutingDecision.executionPlan`;
  `buildExecutionPlan(decision)`, `planContains(plan, target)`, `primaryTarget(plan)`.

## Invariants

- Selection SHALL NOT use a provider's name as a heuristic; allow/deny lists are
  explicit policy.
- A `RoutingDecision` SHALL be deep-frozen (immutable) and deterministic for
  identical (request, policy, registry).
- Routing SHALL depend only on the registry (IOS-001/002), never on adapters.

## Dependencies

- IOS-001, IOS-002 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. Identical `(request, policy, registry)` SHALL yield an equal `RoutingDecision`.
2. A model lacking a required capability SHALL appear in `rejectionReasons` and
   SHALL NOT be selected.
3. The returned decision SHALL be frozen.
4. No name-based selection SHALL occur.
5. (v1.1) The decision SHALL carry an immutable Execution Plan whose `targets[0]`
   equals the selected target and whose remaining entries are the other authorized
   survivors in routing-preference order.

## Related ADRs

- ADR-0001; ADR-0004 (v1.1 Execution Plan).

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/routing/routing-types.ts`, `capability-resolver.ts`,
  `routing-engine.ts`, `execution-plan.ts` (v1.1).
