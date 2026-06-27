# ADR-0010 — Enterprise Governance Orchestrator

| Field | Value |
|-------|-------|
| Identifier | ADR-0010 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | CONST-LAWRENCE v1.0 (Articles I, II, IV, VII); ONT-001; ONT-002; AS-005; ADR-0006; ADR-0008; ADR-0009 |
| Supersedes | — |
| Superseded By | — |

## Title

Introduce the Enterprise Governance Orchestrator — a single, deterministic,
on-demand service that composes the existing governance services into one
`GovernanceDecision` for missions, workflows, imports, API execution, agents, and
future automation.

## Status

Accepted.

## Context

LAWRENCE has built governance bottom-up:

- **VS-003 / ADR-0006** — canonical **object** validation (ONT-001): "is this
  object valid?" — per `upsertObject`, warn-default / opt-in enforce.
- **VS-004 / ADR-0008** — canonical **relationship** validation (ONT-002 / AS-005):
  "is this relationship valid?" — per `linkObjects`, warn/enforce.
- **VS-005 / ADR-0009** — **graph integrity** engine: "is this enterprise graph
  valid?" — on-demand `validateGraph()`, deterministic, rule-driven.
- **VS-006** — **human** review surface over the VS-005 report.
- **VS-007** — **machine** graph preflight gate before mission/workflow execution.

Each answers part of the question. What was missing is **one canonical entry
point** that composes them into a single enterprise decision an execution path
(mission/workflow/import/API/agent/automation) can consult — without re-implementing
any of them, and without coupling validation to the write path.

## Decision

1. Add the **Enterprise Governance Orchestrator**
   (`src/lib/dataops/ontology/governance/`): `evaluateGovernance(ctx, opts)`
   returns a single deterministic `GovernanceDecision`.
2. It invokes, **in order**: (1) object validation (VS-003), (2) relationship
   validation (VS-004), (3) graph integrity (VS-005), (4) graph preflight (VS-007),
   (5) **policy evaluation** (a new extension point). Each stage returns typed,
   normalized `GovernanceFinding`s preserving their source codes (object/
   relationship validator codes, VS-005 `GRAPH_*` codes, policy codes).
3. The orchestrator **composes, does not replace.** Every underlying service
   remains independently callable; the orchestrator calls them all in **warn mode
   internally** so nothing throws mid-pipeline, then makes ONE execution decision.
4. **Execution decisions:** `PASS`, `PASS_WITH_WARNINGS`, `BLOCKED`. Integrity
   verdict (`overallStatus`: pass/warning/failed) is reported separately and is
   mode-independent.
5. **Enforcement** mirrors the rest of the stack (per-tenant → global → env
   `ONTOLOGY_GOVERNANCE_ENFORCEMENT` → default **warn**), independent of the
   object/relationship/graph modes:
   - **warn:** never blocks; returns advisory findings.
   - **enforce:** blocks ONLY on blocking (error-severity) findings — returns a
     `BLOCKED` decision via a thrown `GovernanceDecisionError` (carrying the
     decision).
6. **Policy evaluation is an extension point only** — this ADR ships the registry,
   interfaces, and execution pipeline, and **no business policies**.
7. **On-demand, not wired globally.** No execution path is forced to call it; it
   is exposed for callers to consult at their boundary.

## Alternatives Considered

- **Wire each validator into the write path and skip an orchestrator.** Rejected:
  graph/policy checks are execution preconditions, not write-time invariants;
  coupling them to writes is the opposite of the established warn-then-enforce,
  on-demand posture and would change existing behavior.
- **Fold object/relationship/graph into one mega-validator.** Rejected: each
  service has its own contract, mode, and conformance suite; composition preserves
  independence and traceability.
- **Bake in business policies now.** Rejected: business rules must stay in the
  graph rule registry / pluggable policies, never in the orchestration code.

## Consequences

- A single governance entry point exists for all enterprise execution surfaces,
  producing one auditable, deterministic decision.
- Each finding stays traceable to its originating service/code.
- Operators opt into fail-closed enterprise governance independently of the lower
  modes.
- Slight redundancy: stage 3 (`validateGraph`) and stage 4 (`preflightGraph`) both
  validate the graph; accepted for faithful, independently-invoked composition on
  an on-demand path. Preflight findings are not double-counted (they equal the
  graph findings); the preflight result is retained in the report for traceability.

## Compatibility Analysis

Fully additive. New module + a new opt-off mode; no change to existing signatures,
schemas, tables, write paths, or default behavior; no migration. Each composed
service is unchanged and independently callable. Deterministic (pure aggregation
over sorted sub-results).

## Conformance Impact

New suite `tests/integration/governance-orchestrator.test.ts`: pass / warning /
blocked / advisory-in-warn / mixed-stage findings / stage ordering / policy
extension (contributes + blocks) / isolated-policy-error / no-write-path / event
emission / metrics / determinism. The Conformance Matrix records VS-008 alongside
VS-003…VS-007.

## The enterprise governance pipeline

```
Mission / Workflow / Agent / Import / API / Automation
        │
        ▼
Governance Orchestrator (VS-008)
        ├── Object Validation        (VS-003 / ADR-0006)
        ├── Relationship Validation  (VS-004 / ADR-0008)
        ├── Graph Integrity          (VS-005 / ADR-0009)
        ├── Graph Preflight          (VS-007)
        ├── Policy Evaluation        (extension point — VS-008)
        ├── Execution Decision       (PASS / PASS_WITH_WARNINGS / BLOCKED)
        └── Governance Report
```

VS-006 (human review surface) is the operator-facing view of the same VS-005
report the orchestrator consumes.

## Approval

Recorded by the LAWRENCE Architecture Council, 2026-06-27.
