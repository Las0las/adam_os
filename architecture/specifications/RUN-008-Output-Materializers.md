# RUN-008 — Output Materializers

| Field | Value |
|-------|-------|
| Identifier | RUN-008 |
| Version | 0.2 |
| Status | Draft |
| Authority | Normative Specification (Constitutional Runtime Contract) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, RUN-000, ADR-0005 |

> Constitutional runtime contract. Normative sections define **what must be true**, not
> how. Implementation guidance appears only under Implementation Notes (non-normative).
> Terminology follows RFC-2119. No implementation until ratified and ADR-0005 approved.

## Purpose

Define the canonical **`OutputMaterializer`** and **`MaterializationSink`** model: the
separable seam that persists (or projects) a processor's contract-conformant output,
decoupling "compute" from "persist" so the same processor runs with different sinks across
runtimes — always through governed, audited, tenant-scoped persistence.

## Scope

**In scope:** the `OutputMaterializer` contract; the `MaterializationSink` abstraction;
the `MaterializationResult`; the compute/persist separation; governed-persistence
guarantees (audit, permissions, tenant scope, markings, idempotency).

**Out of scope (Non-Goals):** introducing hidden side effects or direct store writes;
bypassing Security, clearance (RUN-006), or redaction; defining a new storage engine.

## Canonical Object Contract

### Objects Owned
- `OutputMaterializer` — validates and writes a processor output to a **projection** sink.
- `MaterializationSink` — a **projection** target a materializer writes to (incl. a
  preview/no-op sink). Per Principle 0, a sink targets disposable projections only.
- `MaterializationResult` — the typed outcome of a materialization.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| `OutputContract` / `OutputSetContract` | RUN-002 |
| `ProcessorRunContext` | RUN-003 |
| `IncrementalSemantics` | RUN-005 |
| `MarkingSet` / `ClearanceDecision` | RUN-006 |
| `ProcessorEffect` (`ProjectionWrite`) | RUN-011 |
| kernel persistence, `requirePermission`, audit hash-chain | `lawrence-core` (external) |
| lineage emission | DataOps lineage (external) |

> **Principle 0 boundary (RUN-011).** This specification governs **projection**
> materialization only. A reality change is a `CommandIntent` (RUN-011) realized by an
> accepted event through the Ontology/Event subsystem; it is **not** a materialization and
> is **out of scope** here. An `OutputMaterializer` SHALL NOT mutate ontology objects
> directly.

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `MaterializationResult` | runtime executor, lineage, audit, RUN-009 |

## Normative Interfaces

- **RUN-008/1.** A processor SHALL be executable to produce a contract-conformant output
  **without** materializing it; materialization SHALL be an explicit, injected step.
- **RUN-008/2.** An `OutputMaterializer` SHALL validate output against its `OutputContract`
  (RUN-002) before persistence.
- **RUN-008/3.** A `MaterializationSink` SHALL be selectable per `RuntimeProfile` (RUN-004)
  to support distributed/serverless targets without changing the processor.

## Runtime Invariants

- **INV-008.1 (Compute/persist split).** Computation SHALL be possible without
  materialization (preview/dry-run).
- **INV-008.2 (Fail-closed).** Non-conformant output SHALL be rejected with a typed
  `MaterializationFault` (RUN-009); it SHALL NOT be silently written.
- **INV-008.3 (Governed persistence).** All persistence SHALL route through existing kernel
  persistence, `requirePermission`, tenant scoping, and `emitAudit`; a materializer SHALL
  NOT write directly to a store or bypass an access decision (AS-003 R6; Art. V).
- **INV-008.4 (Governance enforcement).** Materialization SHALL enforce markings and
  clearance (RUN-006) and apply redaction where required; it SHALL NOT weaken an existing
  deny.
- **INV-008.5 (Idempotence).** Re-materializing an unchanged output under the processor's
  incremental semantics (RUN-005) SHALL NOT create duplicates.
- **INV-008.6 (No mutation by materialization).** Materialization SHALL NOT alter the
  computed output and SHALL emit lineage/provenance (Art. IV, Art. VII).
- **INV-008.7 (Security boundary).** A materializer/sink SHALL NOT bypass security
  ("a cache SHALL NOT bypass security", Art. V, applied to sinks).
- **INV-008.8 (Projections only; ontology owns reality).** A materializer SHALL write only
  disposable projections (`ProjectionWrite`, RUN-011) and SHALL NOT mutate ontology
  objects or assert business truth. Reality changes SHALL be expressed as `CommandIntent`
  realized by accepted events (Principle 0 §5/§9; Axioms 1–3).
- **INV-008.9 (Projection disposability).** A materialized projection SHALL be rebuildable
  from the ontology and SHALL NOT be treated as authoritative (Axiom 3).

## Conformance Requirements

- **RUN-008/C1.** A processor can compute output without materializing (compute/persist
  split).
- **RUN-008/C2.** Every materialization emits an audit event and respects ACL + tenant
  scope.
- **RUN-008/C3.** Non-conformant output is rejected, not written.
- **RUN-008/C4.** Re-materializing unchanged output creates no duplicates (idempotence).
- **RUN-008/C5.** Materialization never broadens access vs. the Security + clearance
  decision.
- **RUN-008/C6.** A materializer performs no direct ontology mutation; reality changes are
  routed as `CommandIntent` (RUN-011), not materializations.
- **RUN-008/C7.** A materialized projection is rebuildable from the ontology and is not
  treated as authoritative.

## Related Specifications

RUN-000, RUN-002 (output), RUN-003 (context), RUN-004 (sink selection), RUN-005
(idempotency), RUN-006 (governance), RUN-007 (pipelines), RUN-009, RUN-011 (ontology/event
boundary).

## Related ADRs

ADR-0005 (establishing); ADR-0006 (Principle 0 boundary); Constitution Art. V (no security
bypass).

## Implementation Notes (non-normative)

- All writes SHOULD reuse `lawrence-core/db`, `requirePermission`, and `emitAudit`; no new
  storage engine is introduced.
- A `PreviewSink` (no-op) SHOULD mirror existing non-persistent pipeline-preview behavior.
- Likely surface: `interface OutputMaterializer { materialize(ctx, output, sink):
  Promise<MaterializationResult> }`.
