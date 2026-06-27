# RUN-010 — Conformance Tests

| Field | Value |
|-------|-------|
| Identifier | RUN-010 |
| Version | 0.2 |
| Status | Draft |
| Authority | Normative Specification (Constitutional Runtime Contract) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, RUN-000, ADR-0005, CONF-FRAMEWORK |

> Constitutional runtime contract. Normative sections define **what must be true**, not
> how. Implementation guidance appears only under Implementation Notes (non-normative).
> Terminology follows RFC-2119. No implementation until ratified and ADR-0005 approved.

## Purpose

Define the **conformance strategy and suites** for the Runtime Library: each RUN
specification's Conformance Requirements SHALL map 1:1 to executable assertions under
`/conformance/run/<area>`, including the additive-equivalence, dependency-direction, and
ownership-consistency proofs that protect existing behavior and library coherence.

## Scope

**In scope:** the `/conformance/run/<area>` layout; the 1:1 requirement→assertion mapping;
the cross-cutting safety proofs (equivalence, dependency direction, no-collision,
governed materialization, governance composition, observation safety, ownership
consistency).

**Out of scope (Non-Goals):** moving, modifying, or re-homing existing `tests/**` or
`/conformance/ios/**` (CONF-FRAMEWORK §4); defining runtime behavior (it verifies it).

## Canonical Object Contract

### Objects Owned
- RUN conformance suites and assertions under `/conformance/run/**`.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| Conformance Requirements (`RUN-NNN/Cx`) | RUN-001 … RUN-009 |
| canonical-object ownership matrix | RUN-000 |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| RUN conformance suites | governance tooling, CI, Architecture Council |

## Normative Interfaces

- **RUN-010/1.** Suites SHALL live under `/conformance/run/<area>` with areas mirroring
  RUN-001 … RUN-009 (`contract/`, `io/`, `context/`, `profile/`, `incremental/`,
  `governance/`, `registry/`, `materializer/`, `exceptions/`).
- **RUN-010/2.** Each Conformance Requirement `RUN-NNN/Cx` SHALL map to at least one
  executable assertion. A suite verifies but does not define behavior; where suite and
  spec disagree, the spec governs (CONF-FRAMEWORK §3).

## Runtime Invariants (verification obligations)

- **INV-010.1 (Additive equivalence).** A suite SHALL prove that with **no processor
  registered or wrapped**, existing DataOps pipeline behavior and all existing tests are
  byte-for-byte unchanged, and that a pass-through processor yields identical output.
- **INV-010.2 (Dependency direction).** A suite SHALL statically assert no module in
  `aiops/**`, `dataops/**`, `security/**`, `lawrence-core/**`, `domains/**`, or `app/**`
  imports `src/lib/runtime/**` (AS-003 R4), and that `runtime/**` imports only published
  contracts.
- **INV-010.3 (No collision).** A suite SHALL assert `runtime/**` exports none of the
  reserved bare identifiers `ExecutionContext`, `Capability`, `Classification`, `Policy`,
  `Processor`, `Function`, `Pipeline` (AS-003 R10).
- **INV-010.4 (Governed materialization).** A suite SHALL assert every materialization
  emits audit and enforces permission + tenant scope, with no direct-write bypass
  (RUN-008).
- **INV-010.5 (Governance composition).** A suite SHALL assert a clearance decision never
  grants access denied by Security and default marking propagation never broadens access
  (RUN-006).
- **INV-010.6 (Observation safety).** A suite SHALL assert observing a run cannot change
  its outcome or mutate inputs/outputs (Art. IV).
- **INV-010.7 (IOS untouched).** A suite SHALL assert no new IOS execution seam exists and
  `aiops/execution/**` is unmodified (ADR-0003; AS-003 R1).
- **INV-010.8 (Ownership consistency).** A suite SHALL assert each RUN spec's owned objects
  match the RUN-000 matrix and no object is owned twice (RUN-000/C1–C3).

## Conformance Requirements

- **RUN-010/C1.** Each `RUN-NNN/Cx` has at least one mapped executable assertion.
- **RUN-010/C2.** All cross-cutting proofs INV-010.1–INV-010.8 exist and pass.
- **RUN-010/C3.** Existing `tests/**` and `/conformance/ios/**` remain unmoved and
  unmodified.

## Related Specifications

RUN-000 (ownership), RUN-001 … RUN-009 (requirement sources), CONF-FRAMEWORK.

## Related ADRs

ADR-0005 (establishing); ADR-0001 (conformance framework lineage).

## Implementation Notes (non-normative)

- Suites SHOULD reuse the existing architecture-test conventions
  (`tests/unit/architecture-*.test.ts`) for the static/equivalence proofs.
- Sequencing (which proofs are merge-blocking from day one vs. phased) is an open question
  for the Council.
- The suites MAY run in the existing test runner or a dedicated conformance harness.
