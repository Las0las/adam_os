# RUN-005 — Incremental Semantics

| Field | Value |
|-------|-------|
| Identifier | RUN-005 |
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

Define the canonical **`IncrementalSemantics`** model: how a processor declares and
behaves under full, incremental, and snapshot runs, and how deltas are identified, so
re-execution is correct, idempotent, and convergent.

## Scope

**In scope:** `IncrementalMode` (`full | incremental | snapshot`); `IncrementalKey`;
`DeltaSet`; `SnapshotId`; idempotency and convergence obligations; provenance recording.

**Out of scope (Non-Goals):** introducing an event-sourcing substrate (LAWRENCE is not
event-sourced); defining storage (RUN-008).

## Canonical Object Contract

### Objects Owned
- `IncrementalSemantics` — a processor's declared incremental behavior.
- `IncrementalMode` — the mode of a given run.
- `IncrementalKey` — the declared key identifying a unit of change.
- `DeltaSet` — the changed inputs for an incremental run.
- `SnapshotId` — the identity of an immutable point-in-time output.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| lineage/provenance emission | DataOps lineage (external) |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `IncrementalSemantics` / `IncrementalMode` | RUN-001 (declares), RUN-002 (keys on contracts), RUN-003 (mode), RUN-008 |
| `IncrementalKey` / `DeltaSet` / `SnapshotId` | RUN-002, RUN-008 |

## Normative Interfaces

- **RUN-005/1.** A processor SHALL declare its `IncrementalSemantics`. A processor that
  does not support incremental execution SHALL declare `full`.
- **RUN-005/2.** Deltas SHALL be identified by declared `IncrementalKey`s carried on the
  input contract (RUN-002); deltas SHALL NOT be inferred heuristically.
- **RUN-005/3.** Snapshot semantics, when declared, SHALL yield an immutable output
  identified by a `SnapshotId`.

## Runtime Invariants

- **INV-005.1 (Idempotence).** Re-running with no input change SHALL produce no new or
  duplicated materialization.
- **INV-005.2 (Convergence).** The union of incremental runs over a change set SHALL yield
  the same materialized state as a single full run over the final input, barring declared
  non-deterministic inputs.
- **INV-005.3 (Full-only safety).** A processor declaring `full` SHALL never be handed a
  `DeltaSet`.
- **INV-005.4 (Snapshot immutability).** A `SnapshotId`-addressed output SHALL be immutable
  (AS-003 R9).
- **INV-005.5 (Provenance).** Every incremental run SHALL record provenance via the
  existing lineage mechanism (Art. VII).

## Conformance Requirements

- **RUN-005/C1.** Re-run with unchanged input materializes nothing new (idempotence).
- **RUN-005/C2.** Union of incremental runs equals a single full run (convergence).
- **RUN-005/C3.** A `full`-only processor never receives a `DeltaSet`.
- **RUN-005/C4.** Snapshot outputs are immutable and id-addressable.

## Related Specifications

RUN-000, RUN-001, RUN-002 (keys), RUN-003 (mode), RUN-008 (idempotent materialization).

## Related ADRs

ADR-0005 (establishing).

## Implementation Notes (non-normative)

- Incremental keys SHOULD reuse existing idempotency conventions (`objectType +
  externalKey`, content hashes) where applicable; this aligns with the existing
  idempotent upsert + append-only ledger rather than a new delta substrate.
- A "force full" recovery override MAY exist and, if so, SHALL be audited.
- Open: whether delta detection is processor-owned or runtime-provided (RUN-000 OQ-4).
