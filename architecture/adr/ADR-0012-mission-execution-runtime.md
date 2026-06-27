# ADR-0012 — Mission Execution Runtime

| Field | Value |
|-------|-------|
| Identifier | ADR-0012 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | CONST-LAWRENCE v1.0 (Articles I, II, IV, VII); ADR-0010 (Governance Orchestrator); ADR-0009; ADR-0006/0008 |
| Supersedes | — |
| Superseded By | — |

## Title

Introduce the Mission Execution Runtime — the canonical, deterministic engine that
executes enterprise missions after the Governance Orchestrator (VS-008) approves
execution.

## Status

Accepted.

## Context

VS-003…VS-008 built governance: object/relationship validation, graph integrity, a
human review surface, a machine preflight gate, and the Governance Orchestrator
that produces a single `GovernanceDecision`. What was missing is a **runtime that
executes the work** a mission represents — planning tasks, resolving dependencies,
scheduling, dispatching to executors, gating on human approval, retrying, emitting
events, and reporting — once governance permits. Governance decides *whether*
execution may begin; nothing yet *owns* execution.

## Decision

1. Add the **Mission Execution Runtime** (`src/lib/missions/`): `executeMission(ctx,
   mission, opts)` returns a typed `MissionExecutionReport`.
2. **Governance gates, the runtime owns execution.** Stage 0 calls
   `evaluateGovernance()` (VS-008); if the decision is `BLOCKED`, the runtime
   aborts before any task runs (mission state `blocked`).
3. The runtime is composed of generic components: **Execution Planner** +
   **Dependency Resolver** (deterministic dependency-ordered layers, cycle/missing-
   dep detection), **Task Scheduler** (sequential across layers, parallel within a
   layer), **Agent Dispatcher** (executor registry — interfaces + registration +
   dispatch + lifecycle hooks, no concrete agents), **Human Approval Gate**
   (pause/resume on approval checkpoints), **Retry Manager** (deterministic retries,
   no backoff), **Event Publisher** + **Audit Recorder** (typed runtime events), and
   the **Mission State Manager**.
4. **Deterministic only.** No AI planning, no heuristics, no probabilistic
   behavior. Plans, layer ordering, and reports are stable (sorted).
5. **Mission states:** Draft, Ready, Approved, Running, Waiting, Blocked, Failed,
   Completed, Cancelled. **Task states:** Pending, Ready, Running, Waiting,
   Completed, Failed, Skipped, Cancelled.
6. **Generic infrastructure only** — no recruiting/business logic; concrete
   executors register from outside.
7. **Additive, no write-path changes.** The runtime reads governance and emits
   audit events; it does not write ontology objects/relationships and changes no
   existing behavior. It is invoked on demand.

## Alternatives Considered

- **Fold execution into the Governance Orchestrator.** Rejected: governance is a
  decision service; execution is a separate concern with its own lifecycle. Keeping
  them distinct preserves single-responsibility and lets governance be reused by
  non-execution consumers (e.g. VS-006 review).
- **AI/heuristic planning.** Rejected: violates the determinism mandate; mission
  execution must be reproducible and auditable.
- **Ship concrete executors now.** Rejected: this is generic infrastructure; agents
  are registered by domain packs / future slices.

## Consequences

- A single canonical engine executes mission-driven work, gated by governance and
  fully audited.
- Domain packs add behavior by registering executors — no runtime changes needed.
- Human approval is modeled as an execution gate; a stateless run pauses at the
  gate (Waiting) and a subsequent run with the approval granted proceeds. Persisted
  cross-call execution state is future work.
- Failure propagation is deterministic: a failed task skips its transitive
  dependents while independent branches still run; the mission ends Failed.

## Compatibility Analysis

Fully additive. New module + new types; no change to existing signatures, schemas,
tables, write paths, or behavior; no migration. Deterministic outputs.

## Conformance Impact

New suites: `tests/unit/mission-planner.test.ts` (layers/ordering/cycle/missing-
dep/duplicate) and `tests/integration/mission-runtime.test.ts` (success, governance
block, dependency ordering, parallel layers, retries, retry-exhaustion propagation,
approval pause/resume, cancellation, plan-error, missing-executor, no-write-path,
determinism, events). Recorded in the Conformance Matrix.

## How the runtime relates to the rest of the platform

```
Mission
  ▼
Governance Orchestrator (VS-008 / ADR-0010)   ← decides whether execution may begin
  ▼
Mission Runtime (MS-010 / ADR-0012)           ← owns execution
  ├── Execution Planner + Dependency Resolver
  ├── Task Scheduler (sequential / parallel)
  ├── Agent Dispatcher (executor registry)     ← concrete agents register here
  ├── Human Approval Gate (pause/resume)
  ├── Retry Manager (deterministic)
  ├── Event Publisher + Audit Recorder
  └── Mission State Manager → MissionExecutionReport
```

- **Governance Orchestrator** — the gate; the runtime aborts on `BLOCKED`.
- **Missions / Tasks** — the unit of work and its DAG of steps.
- **Agents** — concrete executors registered in the dispatcher (none shipped here).
- **Human Approvals** — execution checkpoints that pause the runtime.
- **Future Workflow Runtime** — a workflow engine can reuse the same planner/
  scheduler/dispatcher/governance pattern; this ADR establishes that shape.

## Approval

Recorded by the LAWRENCE Architecture Council, 2026-06-27.
