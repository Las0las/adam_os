# IOS-017 — Evaluation Engine

| Field | Value |
|-------|-------|
| Identifier | IOS-017 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-005, IOS-013, IOS-014, IOS-015, IOS-016, ADR-0001, ADR-0004, DD-001 |

## Purpose

The Evaluation Engine SHALL be an observational subsystem that evaluates completed
executions and produces the canonical EvaluationResult and EvaluationReport. It
only observes and scores; it SHALL NOT influence execution or routing, authorize
execution targets, or invoke providers directly.

## Scope

Governs EvaluationEngine, EvaluationCriteria/Subject, EvaluationResult,
EvaluationReport, EvaluationPolicy, evaluation events, and evaluation metrics. Out
of scope (future specifications): drift detection, adaptive routing, cost
optimization, SLA enforcement, dashboards, LLM-based grading, and persistence
beyond the in-memory evaluation store.

## Architectural Placement

Evaluation runs within an **Isolated Execution Environment** (reusing the IOS-016
model): executions to evaluate are produced through the public pipeline on a
dedicated, isolated bus, and evaluation observes on an evaluation-scoped bus —
production health (IOS-013) and production metrics are never contaminated.

```
Isolated Execution Environment (IOS-016) → completed executions →
  Evaluation Engine → EvaluationResult / EvaluationReport → Evaluation Store
```

## Responsibilities

- Score completed executions deterministically against immutable criteria.
- Produce canonical EvaluationResult (per subject) and EvaluationReport (aggregate),
  recorded immutably in the evaluation store.
- Publish evaluation events on the evaluation-scoped bus; collect passive metrics.

## Public Interfaces

- `EvaluationEngine.evaluate(subjects)` → `EvaluationReport`; `evaluateReplayRun(run,
  expected?, explanations?)` (consumes an IOS-016 ReplayRun).
- `EvaluationCriterion` (must_succeed | max_latency | no_fallback | output_equals |
  output_contains), `EvaluationSubject`, `EvaluationResult`, `EvaluationReport`,
  `EvaluationPolicy` / `EvaluationPolicyStore`.
- Events (`evaluation.started`, `evaluation.subject_evaluated`,
  `evaluation.completed`); `isEvaluationEvent`. `EvaluationMetricsCollector`.

## Canonical Object Contract

- **Canonical Objects Consumed** (read by reference, never mutated): ExecutionPlan,
  RoutingDecision, ProviderHealthSnapshot, BenchmarkResult, ReplayResult (replay
  execution), ExecutionEvents, Explanation.
- **Canonical Objects Produced**: EvaluationResult (the Evaluation Engine becomes
  its canonical producer) and EvaluationReport.
- **Existing Contracts Reused**: IOS-004 `executeInference` (only via the IOS-016
  Isolated Execution Environment — never invoked by this engine to call providers),
  IOS-005 event bus (a dedicated evaluation-scoped instance), IOS-016 replay model.
- **Authoritative Producers** (of consumed objects): Governed Routing (IOS-003) owns
  RoutingDecision + ExecutionPlan; Provider Health Manager (IOS-013) owns
  ProviderHealthSnapshot; the Execution Pipeline (IOS-004) owns ExecutionEvents;
  Benchmark Harness (IOS-014) owns BenchmarkResult; Traffic Replay (IOS-016) owns
  ReplayResult; Explainability (IOS-015) owns Explanation. This engine SHALL NOT
  redefine or mutate any of them.
- **Authorized Consumers** (of produced objects): EvaluationResult/EvaluationReport
  MAY be read by reporting/SLA/regression/comparison consumers; they SHALL NOT
  mutate published instances.

Authority remains with Governed Routing, the Provider Health Manager, and the
Execution Pipeline. The Evaluation Engine only observes and scores.

## Invariants

- The engine SHALL preserve routing authority, Execution Plan immutability,
  RoutingDecision immutability, execution-pipeline usage, and deterministic scoring.
- The engine SHALL NOT influence execution or routing, authorize targets, invoke
  providers directly, or mutate any consumed canonical object.
- Evaluation SHALL run within an Isolated Execution Environment and SHALL NOT
  contaminate production health or metrics.
- EvaluationResult/Report SHALL be immutable; default policy DISABLED.

## Dependencies

- IOS-004 (executeInference, via IOS-016), IOS-005 (event bus — dedicated instance),
  IOS-016 (Isolated Execution Environment); consumes IOS-003/013/014/015 objects;
  conforms to IOS-006…IOS-012 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. Subjects SHALL be scored against the policy criteria into a canonical
   EvaluationReport (per-subject EvaluationResults, aggregate pass rate / score /
   by-provider breakdown).
2. Scoring SHALL be deterministic for identical (criteria, subjects).
3. Evaluation SHALL publish events and fold into metrics.
4. EvaluationResults and EvaluationReports SHALL be immutable.
5. An IOS-016 replay run SHALL be evaluable, and doing so SHALL NOT contaminate
   production health or metrics.
6. Ineligible providers/workloads SHALL be excluded.
7. A disabled policy SHALL be a no-op; all existing tests SHALL pass unchanged.

### Canonical Object Contract conformance (mandatory)

8. **Read-only consumption** — evaluating a ReplayRun (and any consumed Explanation)
   SHALL NOT mutate it; the consumed objects SHALL be byte-for-byte unchanged after
   evaluation.
9. **Exclusive production** — EvaluationResult/EvaluationReport SHALL be produced
   ONLY by the Evaluation Engine, and SHALL be immutable once produced.
10. **No authority inversion** — the engine SHALL NOT route, authorize execution
    targets, or invoke providers directly; producing EvaluationResult never confers
    any execution/routing authority.
11. **Dependency direction (AS-001)** — the engine SHALL depend only on equal/upper
    layers (IOS-003/004/005 contracts and the IOS-013/014/015/016 objects it
    consumes); it SHALL NOT be depended upon by those producers.
12. **No mutation of unowned objects** — the engine SHALL NOT mutate RoutingDecision,
    ExecutionPlan, ProviderHealthSnapshot, Explanation, BenchmarkResult, or
    ReplayResult (objects it does not own).

## Related ADRs

- ADR-0001 (governance framework); ADR-0004 (Execution Plan — referenced).
  (No new ADR: implemented through published IOS-004/005 contracts and the IOS-016
  Isolated Execution Environment.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/evaluation/*` (evaluation-types, evaluation-scorer,
  evaluation-events, evaluation-store, evaluation-engine, evaluation-metrics,
  evaluation-bootstrap); reuses the IOS-016 replay model on a dedicated evaluation
  bus; wired in `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/evaluation-engine.test.ts`.
