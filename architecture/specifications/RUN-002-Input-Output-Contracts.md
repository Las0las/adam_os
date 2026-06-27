# RUN-002 — Input / Output Contracts

| Field | Value |
|-------|-------|
| Identifier | RUN-002 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-001, RUN-005, RUN-006, RUN-008 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define declarative **InputContract / InputSetContract** and **OutputContract /
OutputSetContract** that a `ProcessorContract` (RUN-001) binds to. These contracts make
a processor's data dependencies and guarantees explicit, schema-checked, and
governance-aware.

## Scope

- Single vs. set (cardinality) input/output contracts.
- Declared schema, required/optional fields, and validation obligations.
- Carriage of governance markings (RUN-006) and incremental keys (RUN-005) at the
  contract boundary.

## Non-Goals

- SHALL NOT define a new persistence schema or replace `dataops` domain types
  (`CanonicalRecord`, `OntologyObject`, `TransformInput/Output`); contracts **describe**
  and **validate** data, they do not redefine storage.
- SHALL NOT perform materialization (RUN-008).

## Normative Requirements

- **RUN-002/1.** An `InputContract` SHALL declare a schema, a cardinality (`single` |
  `set`), and field requiredness. An `InputSetContract` SHALL declare per-member schema
  plus set-level constraints (e.g. ordering, uniqueness key).
- **RUN-002/2.** An `OutputContract` / `OutputSetContract` SHALL declare a schema and the
  guarantees a conformant processor SHALL satisfy (e.g. completeness, determinism,
  marking propagation).
- **RUN-002/3.** Contract validation SHALL be deterministic and SHALL be evaluable
  without executing the processor (static admissibility) and after execution (output
  conformance).
- **RUN-002/4.** A contract violation SHALL raise a typed Runtime Exception (RUN-009),
  never a silent coercion. Inputs failing validation SHALL NOT be passed to execution.
- **RUN-002/5.** Input and output contracts SHALL carry, and SHALL preserve, governance
  markings (RUN-006) and incremental keys (RUN-005) attached to their data.
- **RUN-002/6.** Contracts SHALL be immutable once resolved (AS-003 R9).
- **RUN-002/7 (SHOULD).** Schemas SHOULD reuse the platform's existing schema/validation
  conventions rather than introduce a new schema language.
- **RUN-002/8 (MAY).** A contract MAY declare a sampling/preview projection for
  non-persistent inspection (aligning with existing pipeline preview behavior).

## Proposed Public Surface (illustrative)

`InputContract`, `InputSetContract`, `OutputContract`, `OutputSetContract`,
`ContractCardinality`, `ContractValidationResult`.

## Dependency Direction

Depends on RUN-005 (incremental keys) and RUN-006 (markings) contracts only. Lower
layers SHALL NOT depend on RUN-002.

## Compatibility with AS-001 / IOS

Independent of IOS. May validate the inputs/outputs of a processor that internally calls
`executeInference`, but does not touch the IOS request/response contracts.

## Additive-Only Constraints

New contract types layered over existing data types; existing types unchanged.

## Conformance Hooks

- C1: invalid input raises a typed exception and is not executed.
- C2: output failing its contract is rejected, not silently materialized.
- C3: markings/incremental keys survive a round trip through a pass-through processor.

## Dependencies

Constitution v1.0; AS-003; RUN-001; RUN-005; RUN-006.

## Open Questions

- Schema representation (reuse existing `outputSchema` convention vs. richer descriptor).
- How set-level constraints interact with incremental/delta runs (RUN-005).
