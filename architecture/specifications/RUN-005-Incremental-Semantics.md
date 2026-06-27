# RUN-005 — Incremental Semantics

| Field | Value |
|-------|-------|
| Identifier | RUN-005 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-001, RUN-002, RUN-008 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define **`IncrementalSemantics`**: how a processor declares and behaves under full,
incremental, snapshot, and delta runs, so re-execution is correct, idempotent, and
cost-efficient.

## Scope

- `IncrementalMode` (`full | incremental | snapshot`) and delta computation.
- Incremental keys / change markers carried on input/output contracts (RUN-002).
- Idempotency and convergence guarantees for re-runs.

## Non-Goals

- SHALL NOT introduce an event-sourcing substrate; LAWRENCE is not event-sourced. This
  spec aligns with the existing idempotent upsert + append-only ledger + lineage model
  rather than competing with it.
- SHALL NOT define storage; materialization is RUN-008.

## Normative Requirements

- **RUN-005/1.** A processor SHALL declare its `IncrementalSemantics`. A processor that
  does not support incremental execution SHALL declare `full` and SHALL be executed as a
  full run.
- **RUN-005/2.** An incremental run SHALL be deterministic and idempotent: re-running
  with no input change SHALL produce no new or duplicated materialization (AS-003 R8;
  aligns with existing idempotent upsert).
- **RUN-005/3.** Delta inputs SHALL be identified by declared incremental keys carried on
  the input contract (RUN-002/5); deltas SHALL NOT be inferred heuristically.
- **RUN-005/4.** An incremental run SHALL be **convergent**: the union of incremental
  runs over a change set SHALL yield the same materialized state as a single full run
  over the final input (eventual equivalence), barring declared non-deterministic inputs.
- **RUN-005/5.** Snapshot semantics, when declared, SHALL produce an immutable,
  point-in-time output identified by a snapshot id (AS-003 R9).
- **RUN-005/6.** Provenance for incremental runs SHALL be recorded via the existing
  lineage mechanism so derivation remains traceable (Art. VII).
- **RUN-005/7 (SHOULD).** Incremental keys SHOULD reuse existing idempotency conventions
  (e.g. `objectType + externalKey`, content hashes) where applicable.
- **RUN-005/8 (MAY).** A processor MAY expose a "force full" override for recovery; such
  overrides SHALL be audited.

## Proposed Public Surface (illustrative)

`IncrementalSemantics`, `IncrementalMode`, `IncrementalKey`, `DeltaSet`, `SnapshotId`.

## Dependency Direction

Depends on RUN-002 (keys on contracts) and the lineage/idempotency conventions it reuses.
Lower layers SHALL NOT depend on RUN-005.

## Compatibility with AS-001 / IOS

Independent of IOS. Inference-bearing processors remain single-path; incremental re-runs
of such processors still call `executeInference` per run.

## Additive-Only Constraints

New semantics layered over existing idempotent upsert/ledger/lineage; nothing changed.

## Conformance Hooks

- C1: re-run with unchanged input materializes nothing new (idempotence).
- C2: union of incremental runs equals a single full run (convergence).
- C3: a `full`-only processor never receives a delta set.
- C4: snapshot outputs are immutable and id-addressable.

## Dependencies

Constitution v1.0; AS-003; RUN-001; RUN-002.

## Open Questions

- Alignment vs. distinctness from the ontology append-only ledger (ASSESS-001 OQ-4).
- Whether delta detection is processor-owned or runtime-provided.
