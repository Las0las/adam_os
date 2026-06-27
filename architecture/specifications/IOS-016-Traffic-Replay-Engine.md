# IOS-016 — Traffic Replay Engine

| Field | Value |
|-------|-------|
| Identifier | IOS-016 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-005, IOS-013, IOS-014, IOS-015, ADR-0001, ADR-0004, DD-001 |

## Purpose

The Traffic Replay Engine SHALL replay recorded execution inputs through the public
execution API to observe how the current system handles historical traffic. Replay
is isolated and clearly marked; it SHALL NOT invoke providers directly, mutate
historical events, mutate ExecutionPlans, or alter production routing, and it SHALL
NOT contaminate production health or metrics.

## Scope

Governs TrafficReplayEngine, ReplayRecord, ReplayRun, ReplayResult, ReplayPolicy,
the replay store, replay events, and replay metrics. Out of scope (future
specifications): drift detection, evaluation scoring, adaptive routing, production
shadowing that affects users, and persistence beyond the in-memory replay store.

## Architectural Placement

The engine replays through the public pipeline but observes on a DEDICATED,
replay-scoped event bus — isolated from the production observability bus:

```
Traffic Replay Engine → Governed Routing → Execution Pipeline → Provider Adapter
                                   │
                                   └→ Replay Event Bus → replay-scoped observers
                                      (replay Explainability, replay metrics, store)
```

The engine MAY initiate replays through `executeInference` (via the IOS-003 routing
engine). It SHALL NOT invoke providers directly or bypass the Execution Pipeline.

## Responsibilities

- Register immutable replay records; replay a set through the pipeline by asking
  routing for a decision pinned to the recorded target, then running
  `executeInference` with REPLAY-SCOPED hooks (a publisher bound to the replay bus).
- Mark every replay execution (reserved `__replay__` tenant) and every result
  (`isReplay: true`); record immutable runs/results in an isolated store.
- Publish replay events on the replay bus; collect replay-scoped metrics.

## Isolation (no contamination, by construction)

Replay observation hooks are bound ONLY to the replay bus; the engine NEVER adds
production hooks. Therefore production health (IOS-013) and production metrics —
which subscribe to the production bus — never receive replay events and cannot be
contaminated. Replays are observable through the same infrastructure TYPES (bus →
explanation/metrics), scoped to replay.

## Replay Record / Run / Result

- `ReplayRecord` (immutable fixture): recordId, sourceExecutionId?, inputMessages,
  provider, model, workloadType, requiredCapabilities?, responseFormat?, outputSchema?.
- `ReplayRun` (immutable after completion): replayId, startedAt, endedAt, status,
  results.
- `ReplayResult` (immutable; `isReplay: true`): replayId, recordId,
  sourceExecutionId, replayExecutionId, provider, model, workloadType,
  executionOutcome, success, latencyMs, tokenUsage, errorKind.

## Replay Policy

`ReplayPolicy` (immutable): mode (enabled/disabled), eligibleProviders,
eligibleModels, eligibleWorkloads, maxRecordsPerRun, bypassCache, disableRetry,
disableFallback. The default policy is DISABLED. Bypass/disable flags act only by
choosing the run's replay-scoped hook set; they never mutate global state.

## Events / Metrics

Replay events on the replay bus: `replay.run_started`, `replay.record_started`,
`replay.record_completed`, `replay.record_failed`, `replay.run_completed`;
`isReplayEvent`. Passive replay metrics: runs, records replayed, successes,
failures, success rate, average latency. No dashboards; in-memory store only.

## Invariants

- Replay SHALL preserve routing authority, Execution Plan immutability,
  RoutingDecision immutability, execution-pipeline usage, provider isolation, and
  auditability.
- Replay SHALL NOT invoke providers directly, mutate historical events / the
  RoutingDecision / the Execution Plan / ProviderHealth, alter production routing,
  or contaminate production health/metrics.
- Replay runs/results SHALL be immutable and marked as replays; default DISABLED.

## Dependencies

- IOS-003 (routing), IOS-004 (executeInference), IOS-005 (event bus — a dedicated
  instance); reuses IOS-015 Explainability in replay scope; conforms to IOS-006…
  IOS-014 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A registered record SHALL be replayed through the public pipeline (provider
   reached only via `executeInference`); a successful replay SHALL be marked
   `isReplay: true` with an isolated `replayExecutionId`.
2. Replay executions SHALL NOT contaminate production health or production metrics
   (production subscribers never receive replay events).
3. Replays SHALL be observable on the replay-scoped explanation store.
4. A target routing does not select SHALL be `not_eligible` with NO provider call.
5. A provider failure SHALL be captured as a failed, replay-marked result.
6. Runs and results SHALL be immutable.
7. A disabled policy SHALL be a no-op; all existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0001 (governance framework); ADR-0004 (Execution Plan — referenced via the
  pipeline). (No new ADR: implemented through the published IOS-003/IOS-004 APIs
  and a dedicated IOS-005 bus instance.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/replay/*` (replay-types, replay-events, replay-store,
  replay-metrics, replay-engine, replay-bootstrap); drives `executeInference` via
  `route` on a dedicated replay bus; wired in `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/traffic-replay-engine.test.ts`.
