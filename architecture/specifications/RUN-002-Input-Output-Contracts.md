# RUN-002 — Input / Output Contracts

| Field | Value |
|-------|-------|
| Identifier | RUN-002 |
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

Define the canonical **Input / Output (and Set) Contracts** that a `ProcessorContract`
(RUN-001) binds to, making a processor's data dependencies and guarantees explicit,
schema-checked, and governance-aware.

## Scope

**In scope:** single vs. set cardinality; declared schema and field requiredness;
validation obligations (static admissibility and post-execution conformance); carriage of
governance markings (RUN-006) and incremental keys (RUN-005) at the contract boundary.

**Out of scope (Non-Goals):** redefining persistence/domain types (`CanonicalRecord`,
`OntologyObject`, `TransformInput/Output`); materialization (RUN-008); the execution
context (RUN-003).

## Canonical Object Contract

### Objects Owned
- `InputContract`, `InputSetContract` — declared admissible inputs of a processor.
- `OutputContract`, `OutputSetContract` — declared guaranteed outputs of a processor.
- `ContractValidationResult` — the typed outcome of validating data against a contract.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| `IncrementalKey` | RUN-005 |
| `GovernanceMarking` / `MarkingSet` | RUN-006 |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `InputContract` / `InputSetContract` | RUN-001 (declares), runtime executor (admissibility), RUN-009 |
| `OutputContract` / `OutputSetContract` | RUN-001 (declares), RUN-008 (materialization), RUN-010 |
| `ContractValidationResult` | runtime executor, RUN-008, RUN-009 |

## Normative Interfaces

- **RUN-002/1.** An `InputContract` SHALL declare a schema, a cardinality (`single` |
  `set`), and field requiredness. An `InputSetContract` SHALL additionally declare
  set-level constraints (e.g. uniqueness key, ordering).
- **RUN-002/2.** An `OutputContract` / `OutputSetContract` SHALL declare a schema and the
  guarantees a conformant processor SHALL satisfy.
- **RUN-002/3.** A contract SHALL be evaluable both **before** execution (static
  admissibility of inputs) and **after** execution (output conformance), each producing a
  `ContractValidationResult`.
- **RUN-002/4.** A contract SHALL preserve attached `MarkingSet` (RUN-006) and
  `IncrementalKey` (RUN-005) metadata across validation.

## Runtime Invariants

- **INV-002.1 (Determinism).** Validation SHALL be deterministic for identical data and
  contract.
- **INV-002.2 (Fail-closed).** Input failing validation SHALL NOT be passed to execution;
  output failing validation SHALL NOT be materialized. Each SHALL raise a typed
  `ContractValidationFault` (RUN-009) — never a silent coercion.
- **INV-002.3 (Metadata preservation).** Governance markings and incremental keys present
  on data SHALL survive a round trip through validation unchanged.
- **INV-002.4 (Immutability).** A resolved contract SHALL be immutable (AS-003 R9).

## Conformance Requirements

- **RUN-002/C1.** Invalid input raises a typed fault and is not executed.
- **RUN-002/C2.** Output failing its contract is rejected, not materialized.
- **RUN-002/C3.** Markings and incremental keys survive a pass-through processor round
  trip.
- **RUN-002/C4.** Identical data + contract yields identical `ContractValidationResult`.

## Related Specifications

RUN-000, RUN-001, RUN-005 (keys), RUN-006 (markings), RUN-008 (consumes outputs), RUN-009.

## Related ADRs

ADR-0005 (establishing).

## Implementation Notes (non-normative)

- Schemas SHOULD reuse the platform's existing `outputSchema`/validation conventions
  rather than introduce a new schema language.
- A set contract MAY expose a bounded preview/sample projection mirroring existing
  pipeline-preview behavior.
- Likely shape: `interface OutputContract { schema; cardinality; guarantees }`.
