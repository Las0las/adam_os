# RUN-009 — Runtime Exception Taxonomy

| Field | Value |
|-------|-------|
| Identifier | RUN-009 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-001 … RUN-008 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define the **Runtime Exception taxonomy**: a normalized, typed hierarchy for Processor
Runtime faults (contract violations, capability mismatch, clearance denial,
materialization failure, registry conflict), **separate from** the IOS `ExecutionError`
taxonomy, which it SHALL NOT modify or widen.

## Scope

- A `RuntimeException` base type and an enumerated `RuntimeFaultKind`.
- Specific exception types for each RUN concern.
- Normalization and retryability semantics for processor faults.

## Non-Goals

- SHALL NOT modify, replace, alias, or re-map the IOS `ExecutionError` /
  `ExecutionErrorKind` taxonomy (closed set in `aiops/execution`). The two hierarchies
  are distinct (AS-003 R1, R10).
- SHALL NOT change retry/circuit/fallback behavior, which key off IOS error kinds.

## Normative Requirements

- **RUN-009/1.** All Processor Runtime faults SHALL normalize to a `RuntimeException`
  subtype carrying an enumerated `RuntimeFaultKind`; raw/unknown errors SHALL be wrapped,
  never leaked untyped.
- **RUN-009/2.** The taxonomy SHALL include at least: `ContractValidationFault` (RUN-002),
  `CapabilityMismatchFault` (RUN-004), `IncrementalConsistencyFault` (RUN-005),
  `ClearanceDeniedFault` (RUN-006), `RegistryConflictFault` (RUN-007),
  `MaterializationFault` (RUN-008), and `ProcessorContractViolationFault` (RUN-001).
- **RUN-009/3.** `RuntimeException` SHALL be a **separate hierarchy** from
  `ExecutionError`; a Processor Runtime fault SHALL NOT be presented as an IOS execution
  error and vice versa.
- **RUN-009/4.** When a processor's inference call fails, the underlying IOS
  `ExecutionError` SHALL be preserved (wrapped, not rewritten) so IOS-level diagnostics
  remain intact.
- **RUN-009/5.** Each fault SHALL declare a deterministic `retryable` classification;
  governance/clearance faults SHALL be non-retryable.
- **RUN-009/6.** Exceptions SHALL be immutable once constructed (AS-003 R9) and SHALL
  carry enough context (processor key, run id, fault kind) for audit without leaking
  sensitive payloads or secrets.
- **RUN-009/7 (SHOULD).** Normalization SHOULD mirror the IOS `normalizeError()` pattern
  in shape (a `normalizeRuntimeFault()` analog) for consistency, without sharing types.
- **RUN-009/8 (MAY).** The taxonomy MAY be extended additively by future RUN specs; new
  kinds SHALL be added, never repurposed.

## Proposed Public Surface (illustrative)

`RuntimeException` (base), `RuntimeFaultKind`, the specific fault subtypes above,
`normalizeRuntimeFault()`. (`ProcessorException extends RuntimeException` MAY be used for
processor-specific faults.)

## Dependency Direction

Depends on the RUN concern specs it classifies. Lower layers SHALL NOT depend on RUN-009.
RUN-009 SHALL NOT import or extend `aiops/execution` error types.

## Compatibility with AS-001 / IOS

The IOS error taxonomy is untouched; processor faults are a parallel hierarchy. Wrapping
preserves IOS diagnostics; retry/circuit/fallback semantics are unaffected.

## Additive-Only Constraints

New, separate error hierarchy; IOS `ExecutionError` unchanged and not re-mapped.

## Conformance Hooks

- C1: every RUN fault path raises a typed `RuntimeException`, never an untyped error.
- C2: an inference failure inside a processor preserves the original `ExecutionError`.
- C3: clearance/governance faults are non-retryable.
- C4: RUN-009 does not import or subclass `ExecutionError`/`ExecutionErrorKind`.

## Dependencies

Constitution v1.0; AS-003; RUN-001 … RUN-008.

## Open Questions

- Whether `RuntimeFaultKind` is closed or open-extensible.
- Mapping policy when a processor fault and an IOS error co-occur (which surfaces first).
