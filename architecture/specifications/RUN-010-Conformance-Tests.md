# RUN-010 — Conformance Tests

| Field | Value |
|-------|-------|
| Identifier | RUN-010 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-001 … RUN-009, CONF-FRAMEWORK |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define the **conformance strategy and suites** for the Processor Runtime. Each RUN
specification's Conformance Requirements SHALL map 1:1 to executable assertions under
`/conformance/run/<area>`, including the additive-equivalence and dependency-direction
proofs that protect existing behavior.

## Scope

- The `/conformance/run/<area>` layout and 1:1 requirement→assertion mapping.
- The cross-cutting safety proofs (equivalence, dependency direction, no-collision,
  governed materialization, governance composition, observation safety).

## Non-Goals

- SHALL NOT move, modify, or re-home existing `tests/**` or `/conformance/ios/**`
  (CONF-FRAMEWORK §4). Those remain the de-facto IOS conformance evidence.
- SHALL NOT define runtime behavior; it verifies it.

## Normative Requirements

- **RUN-010/1.** Conformance suites SHALL live under `/conformance/run/<area>` with areas
  mirroring RUN-001 … RUN-009 (e.g. `contract/`, `io/`, `context/`, `profile/`,
  `incremental/`, `governance/`, `registry/`, `materializer/`, `exceptions/`).
- **RUN-010/2.** Each Conformance Requirement `RUN-NNN/§k` SHALL map to at least one
  executable assertion. A suite verifies but does not define behavior; where suite and
  spec disagree, the spec governs (CONF-FRAMEWORK §3).
- **RUN-010/3 (Additive equivalence).** A suite SHALL prove that with **no processor
  registered or wrapped**, existing DataOps pipeline behavior and all existing tests are
  byte-for-byte unchanged; and that a pass-through processor over a wrapped unit yields
  identical output (analogous to the `aroundInvoke` equivalence proof).
- **RUN-010/4 (Dependency direction).** A suite SHALL statically assert that no module in
  `aiops/**`, `dataops/**`, `security/**`, `lawrence-core/**`, `domains/**`, or `app/**`
  imports `src/lib/runtime/**` (AS-003 R4), and that `runtime/**` imports only published
  contracts.
- **RUN-010/5 (No collision).** A suite SHALL assert `runtime/**` exports none of the
  reserved bare identifiers `ExecutionContext`, `Capability`, `Classification`, `Policy`,
  `Processor`, `Function`, `Pipeline` (AS-003 R10).
- **RUN-010/6 (Governed materialization).** A suite SHALL assert that every
  materialization emits an audit event and enforces permission + tenant scope, and that
  no direct store write bypasses the guards (RUN-008; AS-003 R6).
- **RUN-010/7 (Governance composition).** A suite SHALL assert that a clearance decision
  never grants access denied by Security, and that default marking propagation never
  broadens access (RUN-006; AS-003 R7).
- **RUN-010/8 (Observation safety).** A suite SHALL assert that observing a processor run
  cannot change its outcome or mutate inputs/outputs (AS-003 R8; Art. IV).
- **RUN-010/9 (IOS untouched).** A suite SHALL assert no new IOS execution seam exists and
  `aiops/execution/**` is unmodified by the Processor Runtime (ADR-0003; AS-003 R1).
- **RUN-010/10 (SHOULD).** Suites SHOULD reuse existing architecture-test conventions
  (e.g. `tests/unit/architecture-*.test.ts` style) for the static/equivalence proofs.

## Dependency Direction

RUN-010 depends on all RUN specs as the source of requirements; it adds no runtime
dependency of its own.

## Compatibility with AS-001 / IOS

Mirrors the IOS conformance framework; existing IOS suites and tests are untouched.

## Additive-Only Constraints

New `/conformance/run/**` tree only; existing test and conformance trees unchanged.

## Conformance Hooks

This specification *is* the conformance hook layer; its assertions gate any future
Processor Runtime implementation merge.

## Dependencies

Constitution v1.0; AS-003; RUN-001 … RUN-009; Conformance Framework (CONF-FRAMEWORK).

## Open Questions

- Whether RUN suites run in the existing test runner or a dedicated conformance harness.
- Sequencing: which proofs are merge-blocking from day one vs. phased in.
