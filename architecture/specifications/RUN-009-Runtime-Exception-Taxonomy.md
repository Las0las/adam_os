# RUN-009 — Runtime Exception Taxonomy

| Field | Value |
|-------|-------|
| Identifier | RUN-009 |
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

Define the canonical **Runtime Exception taxonomy**: a normalized, typed hierarchy for
Processor Runtime faults, **separate from** the IOS `ExecutionError` taxonomy, which it
SHALL NOT modify, alias, or widen.

## Scope

**In scope:** the `RuntimeException` base; the enumerated `RuntimeFaultKind`; the specific
fault subtypes for each RUN concern; normalization and retryability obligations; wrapping
of underlying IOS errors.

**Out of scope (Non-Goals):** modifying or re-mapping IOS `ExecutionError` /
`ExecutionErrorKind`; changing retry/circuit/fallback behavior (which key off IOS kinds).

## Canonical Object Contract

### Objects Owned
- `RuntimeException` — the base of all Processor Runtime faults.
- `RuntimeFaultKind` — the enumerated fault classification.
- RUN fault subtypes: `ProcessorContractViolationFault` (RUN-001),
  `ContractValidationFault` (RUN-002), `CapabilityMismatchFault` (RUN-004),
  `IncrementalConsistencyFault` (RUN-005), `ClearanceDeniedFault` (RUN-006),
  `RegistryConflictFault` (RUN-007), `MaterializationFault` (RUN-008).

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| `ExecutionError` (wrapped, not modified) | IOS (`aiops/execution`, external) |
| fault conditions from each RUN concern | RUN-001 … RUN-008 |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `RuntimeException` / `RuntimeFaultKind` / subtypes | all RUN specs (raise), runtime executor, RUN-010 |

## Normative Interfaces

- **RUN-009/1.** All Processor Runtime faults SHALL normalize to a `RuntimeException`
  subtype carrying a `RuntimeFaultKind`; raw/unknown errors SHALL be wrapped, never leaked
  untyped.
- **RUN-009/2.** The taxonomy SHALL include at least the subtypes enumerated in Objects
  Owned, one per RUN concern.
- **RUN-009/3.** Each fault SHALL declare a deterministic `retryable` classification.

## Runtime Invariants

- **INV-009.1 (Separate hierarchy).** `RuntimeException` SHALL be a separate hierarchy from
  `ExecutionError`; a Processor Runtime fault SHALL NOT be presented as an IOS execution
  error or vice versa (AS-003 R1, R10).
- **INV-009.2 (Preserve IOS diagnostics).** When a processor's inference call fails, the
  underlying IOS `ExecutionError` SHALL be preserved (wrapped, not rewritten).
- **INV-009.3 (Governance non-retryable).** Governance/clearance faults
  (`ClearanceDeniedFault`) SHALL be non-retryable.
- **INV-009.4 (Immutability & safe context).** A `RuntimeException` SHALL be immutable and
  SHALL carry enough context (processor key, run id, fault kind) for audit without leaking
  sensitive payloads or secrets.
- **INV-009.5 (Additive extension).** New kinds SHALL be added, never repurposed.

## Conformance Requirements

- **RUN-009/C1.** Every RUN fault path raises a typed `RuntimeException`, never an untyped
  error.
- **RUN-009/C2.** An inference failure inside a processor preserves the original
  `ExecutionError`.
- **RUN-009/C3.** Clearance/governance faults are non-retryable.
- **RUN-009/C4.** RUN-009 does not import or subclass `ExecutionError`/`ExecutionErrorKind`.

## Related Specifications

RUN-000, RUN-001 … RUN-008 (fault sources), RUN-010 (verifies).

## Related ADRs

ADR-0005 (establishing); ADR-0003 (IOS error taxonomy unchanged).

## Implementation Notes (non-normative)

- Normalization SHOULD mirror the IOS `normalizeError()` *shape* via a
  `normalizeRuntimeFault()` analog — without sharing types.
- `ProcessorException extends RuntimeException` MAY be used for processor-specific faults.
- Open: whether `RuntimeFaultKind` is closed or open-extensible (RUN-000 OQ).
