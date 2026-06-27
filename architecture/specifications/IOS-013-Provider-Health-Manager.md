# IOS-013 — Provider Health Manager

| Field | Value |
|-------|-------|
| Identifier | IOS-013 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-005, IOS-010, IOS-011, IOS-012, ADR-0001, DD-001 |

## Purpose

The Provider Health Manager SHALL be the canonical producer of normalized provider
health state. It SHALL observe execution events and maintain immutable
ProviderHealth snapshots derived ONLY from observed execution outcomes. It SHALL
observe, evaluate, publish, and expose health — and nothing else.

## Scope

Governs ProviderHealthManager, the ProviderHealth store, the HealthEvaluator,
HealthPolicy, health events, and health metrics. Out of scope (future
specifications): active/synthetic health probes, predictive or adaptive health,
adaptive routing, health-based provider selection, benchmark execution, cost
optimization, SLA enforcement, automatic policy tuning.

## Architectural Placement

The manager is a PURELY OBSERVATIONAL subscriber on the Execution Event Bus
(IOS-005) — it registers NO execution hook and changes no execution behavior:

```
Execution Pipeline → Execution Event Bus → Provider Health Manager →
  ProviderHealth Store → Consumers (Circuit Breaker, Fallback Orchestrator,
  Governed Routing, Explainability, Benchmark Harness, SLA Manager)
```

## Responsibilities

- Observe execution outcomes (`execution.completed`/`failed`), retry outcomes
  (`retry.succeeded`/`exhausted`), circuit transitions (`circuit.*`), and fallback
  activations (`fallback.started`).
- Maintain an immutable ProviderHealthSnapshot per provider+model.
- Evaluate a normalized status deterministically (with hysteresis).
- Publish health events and collect passive health metrics.
- Expose the ProviderHealth store as the canonical, read-only health source.

## ProviderHealthSnapshot (canonical platform object)

`ProviderHealthSnapshot` (immutable; frozen on publication) contains: provider,
model, status, availability, latencyMs, timeoutRate, errorRate, retrySuccessRate,
circuitState, fallbackFrequency, healthScore, lastUpdated. (Named
`ProviderHealthSnapshot` to distinguish it from the legacy Milestone-5.0
`ProviderHealth` registry view.)

`ProviderHealthSnapshot` is a **canonical platform object**:

> ProviderHealthSnapshot SHALL be the canonical, immutable representation of
> observed provider health. It SHALL be produced exclusively by the Provider Health
> Manager and SHALL be consumed by Routing, Circuit Breaker, Fallback Orchestrator,
> Explainability, Benchmark Harness, SLA Manager, and other observational
> specifications. No consumer SHALL modify published ProviderHealthSnapshot
> instances.

### Authority

- The Provider Health Manager **owns** `ProviderHealthSnapshot`.
- Consumers **may observe** `ProviderHealthSnapshot`.
- Consumers **SHALL NOT redefine or mutate** `ProviderHealthSnapshot`.
- Routing **MAY consume** `ProviderHealthSnapshot` but remains the **sole authority
  for ExecutionPlan production** (ADR-0004) — health informs, it never authorizes
  or selects execution targets.

## Health States

`Healthy`, `Degraded`, `Unavailable`, `Unknown`. No adaptive or predictive states.

## Health Evaluation

Health is derived ONLY from observed execution outcomes (successful execution,
timeout, provider unavailable, retry exhaustion, circuit open, fallback
activation) over a count-based observation window. There is NO active probing.
Evaluation is deterministic and uses hysteresis: degradation thresholds drop the
status; the higher recovery threshold is required to return to Healthy; an observed
open circuit forces Unavailable.

## Health Policy

`HealthPolicy` (immutable): mode (enabled/disabled), observationWindow,
degradedBelow, unavailableBelow, recoverAbove, eligibleProviders,
eligibleWorkloads. Policies SHALL remain immutable during execution; the default
policy is DISABLED (observational no-op until enabled).

## Events

Immutable events on the Execution Event Bus: `provider_health.updated`,
`provider_health.degraded`, `provider_health.recovered`,
`provider_health.unavailable`; `isHealthEvent`. The manager IGNORES its own
`provider_health.*` events (no recursion).

## Metrics

Passive metrics: updates, status transitions, degraded/unavailable/recovered
counts, accumulated degraded duration, and per-provider availability/latency
(uptime view). No dashboards; no persistence beyond the ProviderHealth store.

## Invariants

- The manager SHALL preserve execution identity, Execution Plan immutability,
  RoutingDecision immutability, middleware ordering, and deterministic execution.
- The manager SHALL NOT perform routing, authorize execution targets, modify
  Execution Plans, invoke providers, retry requests, or trigger fallback.
- ProviderHealth snapshots SHALL be immutable after publication; consumers READ
  them and SHALL NOT mutate them.
- Health is observational; execution and routing remain authoritative.

## Consumers

ProviderHealth SHALL be consumable (read-only) by IOS-011 Circuit Breaker, IOS-012
Fallback Orchestrator, future Governed Routing revisions, IOS-014 Benchmark
Harness, IOS-015 Explainability Engine, and IOS-020 SLA Manager. Consumers SHALL
read published health state and SHALL NOT mutate it.

## Dependencies

- IOS-005 (event bus); observes IOS-004/010/011/012 events; conforms to IOS-003,
  IOS-006, IOS-007, IOS-008, IOS-009 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. No snapshot SHALL exist for a provider+model until an eligible event is observed.
2. Successful executions SHALL keep a provider Healthy with full availability.
3. Availability between thresholds SHALL transition the provider to Degraded.
4. Availability below the unavailable threshold (or an observed open circuit) SHALL
   transition the provider to Unavailable.
5. A Degraded/Unavailable provider SHALL recover to Healthy only at/above the
   recovery threshold (hysteresis).
6. Published snapshots SHALL be immutable.
7. Evaluation SHALL be deterministic for an identical event sequence.
8. Each update SHALL publish `provider_health.updated`; status changes SHALL
   publish the corresponding transition event.
9. Health metrics SHALL be produced.
10. The store SHALL expose read-only snapshots to consumers; the manager SHALL NOT
    react to its own health events.
11. A disabled policy (and ineligible providers/workloads) SHALL be a no-op; all
    existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0001 (governance framework). (No new ADR: implemented entirely through the
  published IOS-005 event-bus subscriber contract.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/health/*` (health-types, health-evaluator, health-events,
  health-store, health-manager, health-metrics, health-bootstrap); subscribes to
  the IOS-005 bus; wired in `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/provider-health-manager.test.ts`.
