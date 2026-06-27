# ADR-0013 — Governed Action Executor + Mission Execution Persistence

| Field | Value |
|-------|-------|
| Identifier | ADR-0013 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | ADR-0012 (Mission Execution Runtime); ADR-0010 (Governance Orchestrator); Mission Control action engine (§34–§35) |
| Supersedes | — |
| Superseded By | — |

## Title

Make the Mission Execution Runtime (MS-010) load-bearing: add a generic governed
action executor and durable, queryable mission-execution records.

## Status

Accepted.

## Context

MS-010 (ADR-0012) delivered a generic, governance-gated mission runtime, but
deliberately shipped **without executors or persistence**. As merged it was inert:
the executor registry was empty (every task failed "no executor registered"),
nothing in the platform called `executeMission`, and execution reports lived only
in memory. The highest-leverage, debt-free next step is to make the runtime
*real* by closing exactly those two declared gaps — reusing existing abstractions,
not adding new concepts or business logic.

## Decision

1. **Governed Action Executor** (`src/lib/missions/executors/action-executor.ts`):
   a single generic `TaskExecutor` (key `mission.action`) that dispatches a task to
   the existing Mission Control action engine via `executeAction()`. This reuses
   the full governed pipeline — idempotency, permission, object-ACL, approval
   routing, audit, runtime trace — so a mission can orchestrate **any** registered
   governed action with **zero duplication**. It is infrastructure (a bridge), not
   a concrete business agent. It self-registers on import and is wired via the
   platform runtime bootstrap.
2. **Fail-closed status mapping:** `completed` → task success (output carries the
   `actionExecutionId` + result); `blocked` / `awaiting_approval` / `failed` →
   thrown error so the runtime fails and propagates (no silent degradation).
   Mission-level human approval remains the runtime's `requiresApproval` gate.
3. **Durable Mission Executions:** a `missionExecutions` collection (standard
   in-memory + lazy-DDL Postgres `Collection` seam) persists every
   `MissionExecutionReport` as a tenant-scoped record at **every** exit path
   (completed/failed/blocked/waiting/cancelled). Reads via
   `getMissionExecution` / `listMissionExecutions`. Persistence is **not**
   swallowed — a failure propagates (fail-closed).
4. **Additive only:** no write-path changes to objects/relationships, no UI, no
   concrete domain agents, no new governance concepts, no migration (the lazy-DDL
   convention used by `action_executions`/`runtime_traces` applies).

## Alternatives Considered

- **Add more runtime features (sub-missions, persisted resume) first.** Rejected:
  deepens an abstraction nothing calls; wiring it to reality is higher-leverage.
- **A bespoke executor that re-implements side-effect governance.** Rejected:
  duplicates the action engine; `executeAction` already is the single sanctioned,
  audited side-effect path.
- **Add a `mission` runtime-trace type.** Rejected as unnecessary: bridged tasks
  already emit `action` traces via `executeAction`, and MS-010 emits mission audit
  events — observability is already covered without touching the shared `TraceType`.
- **Persist only in memory.** Rejected as a placeholder; the `Collection` seam
  gives durable Postgres persistence via lazy DDL with no extra surface.

## Consequences

- The governance → runtime → action path is now exercised end-to-end: a mission
  can perform real, governed, audited work, and every run is durable and queryable.
- Determinism of a mission is now "deterministic given deterministic executors";
  the action executor's determinism follows the underlying action (governed/audited).
- Mission-task-level handling of an action's *own* approval gate is intentionally
  out of scope (surfaced fail-closed); deeper integration is a follow-up.

## Compatibility Analysis

Fully additive. `executeMission`/`MissionExecutionReport` signatures unchanged
(persistence is an internal side effect at exit). New collection + new executor +
one bootstrap import. No breaking changes; no migration. In-memory tests and
lazy-DDL Postgres both covered.

## Conformance Impact

New suite `tests/integration/mission-action-executor.test.ts`: action bridge
completes a governed action; blocked action fails the task (fail-closed); missing
`actionKey` fails clearly; executions are persisted and queryable (including
governance-blocked runs); multi-task persistence. Existing MS-010 suites remain
green. Recorded in the Conformance Matrix.

## Approval

Recorded by the LAWRENCE Architecture Council, 2026-06-27.
