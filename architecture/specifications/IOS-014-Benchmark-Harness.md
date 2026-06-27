# IOS-014 — Benchmark Harness

| Field | Value |
|-------|-------|
| Identifier | IOS-014 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-005, IOS-010, IOS-011, IOS-012, IOS-013, ADR-0001, DD-001 |

## Purpose

The Benchmark Harness SHALL execute controlled, deterministic benchmark runs across
providers, models, workloads, and evaluation fixtures, measuring provider/model
behavior WITHOUT modifying routing, execution, provider adapters, security
middleware, cache behavior, or the Execution Plan. Benchmarking is observational
and evaluative; it SHALL NOT become runtime routing logic.

## Scope

Governs BenchmarkHarness, BenchmarkSuite, BenchmarkCase, BenchmarkRun,
BenchmarkResult, BenchmarkPolicy, benchmark metrics, and benchmark events. Out of
scope (future specifications): Traffic Replay, Drift Detection, Evaluation Engine,
Adaptive Routing, Cost Optimization, SLA Enforcement, dashboards, persistence
beyond the in-memory result store, and LLM-based grading.

## Architectural Placement

```
Benchmark Harness → Governed Routing → Execution Plan → Execution Pipeline →
  Execution Middleware → Provider Adapter → Execution Event Bus →
  Benchmark Results Store
```

The harness MAY initiate benchmark executions through existing public execution
APIs (`executeInference`, via the IOS-003 routing engine). It SHALL NOT invoke
providers directly and SHALL NOT bypass the Execution Pipeline.

## Responsibilities

- Register immutable suites; execute each suite against every eligible
  provider+model by asking routing for a decision pinned to the target, then
  running the public pipeline.
- Score each case deterministically; record immutable runs/results.
- Publish benchmark events and collect passive benchmark metrics.

## Benchmark Suite

`BenchmarkSuite` (immutable during execution): suiteId, name, workloadType, cases,
eligibleProviders, eligibleModels, scoringStrategy, timeoutMs (timeout policy;
enforcement delegated to the pipeline's normalized timeout handling).

## Benchmark Case

`BenchmarkCase` (deterministic fixture; no random generation): caseId,
inputMessages, expectedOutputShape, requiredCapabilities, workloadType,
responseFormat, scoringMetadata.

## Benchmark Run

`BenchmarkRun` (immutable after completion): runId, suiteId, provider, model,
workloadType, startedAt, endedAt, status, results.

## Benchmark Result

`BenchmarkResult` captures: provider, model, workloadType, latencyMs, tokenUsage,
executionOutcome, success, normalizedScore, validationErrors, retryCount,
fallbackOccurred, circuitBreakerState, and `healthSnapshotRef` — a reference (the
`provider|model` key) into the IOS-013 ProviderHealth store (read-only; the harness
never mutates health).

## Benchmark Policy

`BenchmarkPolicy` (immutable): enabled, eligibleProviders, eligibleModels,
eligibleWorkloads, maxCasesPerRun, timeoutMs, bypassCache, bypassSemanticCache,
disableFallback, disableRetry. The default policy is DISABLED. Bypass/disable flags
are honored by dropping the corresponding middleware from the run's hook list — the
harness NEVER mutates any global subsystem policy. (The cache platform exposes a
single middleware entry point, so cache bypass is applied at that entry point.)

## Events

Immutable events on the Execution Event Bus: `benchmark.run_started`,
`benchmark.case_started`, `benchmark.case_completed`, `benchmark.case_failed`,
`benchmark.run_completed`, `benchmark.run_failed`; `isBenchmarkEvent`.

## Metrics

Passive metrics: cases executed, success rate, average latency, provider score,
model score, failures by provider, failures by workload. No dashboards, no adaptive
routing, no optimization.

## Invariants

- The harness SHALL preserve routing authority, Execution Plan immutability,
  execution-pipeline usage, provider isolation, auditability, and deterministic
  scoring.
- The harness SHALL NOT invoke providers directly, mutate provider adapters, mutate
  the RoutingDecision or Execution Plan, influence production routing, bypass
  security, bypass telemetry, or perform adaptive selection.
- BenchmarkSuite/Case/Run/Result SHALL be immutable; the default policy is DISABLED.

## Dependencies

- IOS-003 (routing), IOS-004 (executeInference), IOS-005 (event bus); references
  IOS-013 ProviderHealth; conforms to IOS-006…IOS-012 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A registered suite SHALL be stored immutably and be listable.
2. A suite SHALL execute through the public pipeline (provider reached only via
   `executeInference`); a successful run SHALL record results with scores.
3. Scoring SHALL be deterministic for an identical run.
4. A provider failure SHALL yield a failed case (outcome `failure`, score 0) and a
   `benchmark.case_failed` event.
5. A run SHALL publish run_started, case_started, case_completed/failed, and
   run_completed events.
6. Benchmark metrics SHALL be produced.
7. A target routing does not select SHALL be recorded as `not_eligible` with NO
   provider invocation.
8. Bypass/disable flags SHALL drop the corresponding middleware for the run only.
9. Runs and results SHALL be immutable.
10. A disabled policy SHALL be a no-op; all existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0001 (governance framework). (No new ADR: implemented entirely through the
  published IOS-003 routing and IOS-004 execution APIs and the IOS-005 bus.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/benchmark/*` (benchmark-types, benchmark-scorer, benchmark-events,
  benchmark-store, benchmark-metrics, benchmark-harness, benchmark-bootstrap);
  drives `executeInference` via `route`; wired in `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/benchmark-harness.test.ts`.
