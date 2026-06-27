# ADR-0009 — Enterprise Graph Integrity Engine

| Field | Value |
|-------|-------|
| Identifier | ADR-0009 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | CONST-LAWRENCE v1.0 (Articles I, II, IV, VII); ONT-001; ONT-002; AS-005; ADR-0006; ADR-0008 |
| Supersedes | — |
| Superseded By | — |

## Title

Introduce the Enterprise Graph Integrity Engine — a governed, deterministic
service that validates the whole ontology graph, above object (ADR-0006) and
relationship (ADR-0008) enforcement.

## Status

Accepted.

## Context

ONT-001/ADR-0006 validate individual **objects**; ONT-002/ADR-0008 validate
individual **relationships**. Both answer "is this entity valid?". Neither answers
"is the enterprise **graph** valid?" — required relationships present, cardinality
satisfied, no orphans, no illegal cycles, no duplicate canonical edges, no illegal
shortcut paths, required reachability, and policy preconditions. Enterprise
workflows, missions, analytics, and AI reasoning need a structural guarantee about
the graph *before* they execute. Constitution Articles I and VII require this be a
single, authoritative, traceable capability rather than ad-hoc checks scattered
across callers.

## Decision

1. Add the **Enterprise Graph Integrity Engine** as a governed platform service
   (`src/lib/dataops/ontology/graph/`): `validateGraph(ctx, opts)` returns a
   deterministic `GraphIntegrityReport`.
2. Validation is **deterministic and rule-driven**: generic validators hold no
   business logic; all constraints live in a configurable rules registry
   (`graph-rules.ts`). No AI, no heuristics, no probability.
3. It evaluates: required relationships, cardinality, orphans, duplicate canonical
   edges, illegal shortcut paths, cycles (configurable allow-list), reachability,
   and policy preconditions — with typed codes (`GRAPH_*`).
4. **Enforcement mirrors ADR-0006/0008 exactly**: per-tenant → global → env
   (`ONTOLOGY_GRAPH_ENFORCEMENT`) → default. Default **warn** (returns a report,
   never throws). **enforce** throws `GraphIntegrityError` on an invalid graph
   (after emitting the rejected event). Independent of object/relationship modes.
5. The engine is **on-demand**: it is NOT wired into `upsertObject`/`linkObjects`.
   Callers (workflows, missions, analytics) invoke it explicitly. Existing
   behavior is therefore unchanged unless graph enforcement is explicitly enabled
   AND the engine is invoked.
6. Governance **events** are emitted for every outcome (`ontology.graph.validated`
   / `warning` / `rejected` / `policy_failed` / `cycle_detected` /
   `orphan_detected`) and **metrics** are tracked.

## Alternatives Considered

- **Per-write graph validation** (validate the whole graph on every edge/object
  write). Rejected: O(graph) cost per write, and graph-level invariants are
  workflow preconditions, not write-time invariants.
- **AI/heuristic graph analysis.** Rejected: violates the determinism requirement;
  governance must be reproducible.
- **Hardcode business rules in validators.** Rejected: rules must be configurable
  and auditable; validators stay generic.

## Consequences

- LAWRENCE can guarantee enterprise-graph integrity before orchestration,
  reasoning, analytics, and automation — the foundation for missions.
- Operators opt into fail-closed graph integrity per tenant/global/env.
- Default behavior is unchanged (warn; on-demand). New callers handle
  `GraphIntegrityError` under enforce mode.
- Rules referencing not-yet-implemented object types (Resume, Interview, Offer,
  Placement, Mission, Client, Task, Artifact) are future-safe: they only produce
  findings when such objects exist.

## Compatibility Analysis

Fully additive. New module + new opt-off mode; no change to existing signatures,
schemas, tables, or default behavior; no migration. Dependency direction
preserved (the engine depends on the Constitution and reads the ontology; nothing
depends on it yet). Determinism: outputs are sorted and stable.

## Conformance Impact

New suites (`tests/unit/graph-integrity.test.ts`, `graph-enforcement.test.ts`)
prove every validation category, determinism, warn/enforce/tenant/global modes,
typed errors, events, and metrics. The Conformance Matrix records ONT-001/002 and
the graph engine together.

## Approval

Recorded by the LAWRENCE Architecture Council, 2026-06-27.
