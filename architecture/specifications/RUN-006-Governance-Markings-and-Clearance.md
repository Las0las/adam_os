# RUN-006 — Governance Markings and Clearance

| Field | Value |
|-------|-------|
| Identifier | RUN-006 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-002, RUN-003, RUN-008 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define **`GovernanceMarking`** / **`MarkingSet`** and **`ClearancePolicy`** /
**`ClearanceDecision`**: a markings-and-clearance model that travels with processor data,
propagates onto derived outputs, and gates access by **composing with** the existing
Security access decision — never replacing or relaxing it.

## Scope

- Governance markings attached to data and propagated through processors.
- Clearance entitlements held by principals and the policy that evaluates marking vs.
  clearance.
- Composition with the existing `evaluateObjectAccess` / `AccessDecision`.

## Non-Goals

- SHALL NOT redefine or replace Security `DataClassification` (data sensitivity).
  **Marking/Clearance (entitlement-based access) and Classification (sensitivity
  tagging) SHALL remain distinct concepts** (AS-003 R10).
- SHALL NOT introduce a parallel or competing access-control path.
- SHALL NOT weaken redaction, retention, RBAC/ABAC, or tenant isolation.

## Normative Requirements

- **RUN-006/1.** A `GovernanceMarking` SHALL be a declared label; a `MarkingSet` SHALL be
  the set of markings on a datum. Markings SHALL NOT be inferred from content alone
  without a declared detector source.
- **RUN-006/2.** A processor SHALL propagate input markings onto derived outputs by a
  declared rule; the default rule SHALL be **union-and-preserve** (outputs are at least
  as restricted as their inputs). A processor SHALL NOT drop a marking without an
  explicit, audited declassification step.
- **RUN-006/3.** A `ClearancePolicy` SHALL evaluate `(MarkingSet, principal clearances)`
  to a `ClearanceDecision`. A clearance decision SHALL only ever **further restrict**
  access; it SHALL NOT grant access denied by the existing Security access decision
  (AS-003 R7).
- **RUN-006/4.** Clearance evaluation SHALL **compose with** `evaluateObjectAccess`:
  effective access = (Security decision) AND (clearance decision). Deny-override
  semantics SHALL be preserved.
- **RUN-006/5.** Marking assignment, propagation, declassification, and clearance denials
  SHALL be audited via the existing audit hash-chain (Art. VII).
- **RUN-006/6.** Markings and clearance decisions SHALL be immutable once produced
  (AS-003 R9).
- **RUN-006/7 (SHOULD).** Markings SHOULD be expressible as policy `config` on existing
  `ObjectAccessPolicy` where practical, to reuse the established policy surface.
- **RUN-006/8 (MAY).** A `ClearancePolicy` MAY reference principal attributes already in
  `SecurityContext` (roles, groups, attributes).

## Proposed Public Surface (illustrative)

`GovernanceMarking`, `MarkingSet`, `MarkingPropagationRule`, `ClearancePolicy`,
`ClearanceDecision`, `ClearanceLevel`. (`*Policy` names are qualified; bare `Policy`
SHALL NOT be exported — AS-003 R10.)

## Dependency Direction

Depends on Security public contracts (`AccessDecision`, `SecurityContext`,
`evaluateObjectAccess`) and RUN-002/003. Lower layers (including Security) SHALL NOT
depend on RUN-006.

## Compatibility with AS-001 / IOS

Independent of IOS. Aligns with Constitution Art. V: governance attaches as evaluation
that further restricts; it never reroutes, retries, or mutates provider behavior, and a
cache/materializer SHALL NOT bypass it.

## Additive-Only Constraints

New types composing with Security; Security contracts unchanged; access can only narrow.

## Conformance Hooks

- C1: clearance decision never grants what Security denied (monotone restriction).
- C2: default propagation makes outputs at least as restricted as inputs.
- C3: declassification requires an explicit, audited step.
- C4: marking/clearance never reuses or aliases `DataClassification`.

## Dependencies

Constitution v1.0; AS-003; Security public contracts; RUN-002; RUN-003.

## Open Questions

- Canonical clearance lattice and whether compartments/caveats are in scope v1.
- Whether markings persist as a new record type or as policy config on existing objects.
