# IOS-005 — Execution Event Bus & Observability

| Field | Value |
|-------|-------|
| Identifier | IOS-005 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-004, IOS-006, IOS-007, ADR-0001 |

## Purpose

The Execution Event Bus SHALL be the canonical publish/subscribe seam through
which every execution is observed, decoupling observers from the pipeline and from
each other. Observability (telemetry, metrics, audit, passive health) SHALL be
implemented as bus subscribers (Constitution, Article IV §3–4). Covers Milestones
5.0 (observability) and 5.5 (event bus).

## Scope

Governs the canonical execution events, the event bus, the single bridge
middleware that publishes them, and the four core observation subscribers.
Excludes security events (IOS-006) and cache events (IOS-007), which ride the same
bus as additional event families.

## Responsibilities

- Define canonical, immutable, self-describing events: ExecutionStarted /
  ExecutionCompleted / ExecutionFailed (with usage, latency, finish reason,
  normalized error, retryable flag, request/response fingerprints, routing
  decision).
- Provide a synchronous, priority-independent, isolated pub/sub bus (`BusEvent`
  base; subscribers narrow by type).
- Publish events via ONE bridge middleware (the event publisher).
- Provide observation subscribers: Telemetry (capture), Metrics (passive
  counters), Audit (immutable records), Passive Health (per-provider status).

## Public Interfaces

- `ExecutionEventBus` (`subscribe`, `publish`, `subscribers`), `BusEvent`,
  `ExecutionEventSubscriber`.
- `ExecutionEvent` union + builders; `isExecutionEvent`.
- `ExecutionEventPublisher` (bridge middleware).
- `ExecutionTelemetryEngine`, `MetricsCollector`, `ExecutionAuditEngine`,
  `PassiveHealthCollector`.

## Invariants

- Delivery SHALL be synchronous; the bus SHALL NOT retry, persist, queue, or use
  an external broker.
- Subscriber ordering SHALL be priority-independent; a subscriber SHALL NOT assume
  order, and a throwing subscriber SHALL NOT affect peers or execution.
- Observation SHALL NOT mutate request/response and SHALL NOT perturb the
  deterministic clock or identifiers (observers read wall-clock time only).
- Events SHALL be immutable.

## Dependencies

- IOS-004 (lifecycle + hooks) · AS-001 · Constitution v1.0.

## Conformance Requirements

1. Each inference SHALL emit exactly one terminal event (completed or failed).
2. `publish` SHALL deliver to all subscribers before returning (synchronous).
3. A throwing subscriber SHALL NOT prevent other subscribers from receiving the
   event, nor change the execution result.
4. A security/validation rejection SHALL NOT degrade provider health.

## Related ADRs

- ADR-0001.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/execution/observability/*` (event bus, publisher, events,
  telemetry, metrics, audit, health, bootstrap).
