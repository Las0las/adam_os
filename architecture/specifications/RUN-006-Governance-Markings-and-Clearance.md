# RUN-006 — Governance Markings and Clearance

| Field | Value |
|-------|-------|
| Identifier | RUN-006 |
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

Define the canonical **`GovernanceMarking` / `MarkingSet`** and **`ClearancePolicy` /
`ClearanceDecision`** model: markings that travel with processor data and propagate onto
derived outputs, and a clearance evaluation that gates access by **composing with** the
existing Security access decision — never replacing or relaxing it.

## Scope

**In scope:** governance markings on data and their propagation; the
`MarkingPropagationRule`; clearance entitlements and the policy evaluating marking vs.
clearance; composition with `evaluateObjectAccess` / `AccessDecision`.

**Out of scope (Non-Goals):** redefining or replacing Security `DataClassification`
(sensitivity tagging); introducing a parallel access-control path; weakening redaction,
retention, RBAC/ABAC, or tenant isolation.

## Canonical Object Contract

### Objects Owned
- `GovernanceMarking`, `MarkingSet` — labels on a datum.
- `MarkingPropagationRule` — how a processor propagates input markings to outputs.
- `ClearancePolicy` — evaluates `(MarkingSet, principal clearances)`.
- `ClearanceDecision` — the result of clearance evaluation.
- `ClearanceLevel` — a principal's entitlement level.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| `AccessDecision` | Security (`evaluateObjectAccess`, external) |
| `SecurityContext` | Security (external) |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `GovernanceMarking` / `MarkingSet` | RUN-002 (carriage), RUN-008 (enforcement), audit |
| `MarkingPropagationRule` | RUN-001 (declared), RUN-008 |
| `ClearancePolicy` / `ClearanceDecision` | RUN-003 (context), RUN-008 (enforcement) |

## Normative Interfaces

- **RUN-006/1.** A `GovernanceMarking` SHALL be a declared label; a `MarkingSet` SHALL be
  the markings on a datum. Markings SHALL NOT be inferred from content without a declared
  detector source.
- **RUN-006/2.** A processor SHALL propagate input markings to derived outputs by a
  declared `MarkingPropagationRule`; the default rule SHALL be **union-and-preserve**.
- **RUN-006/3.** A `ClearancePolicy` SHALL evaluate `(MarkingSet, principal clearances)` to
  a `ClearanceDecision`, composed with the Security `AccessDecision`.

## Runtime Invariants

- **INV-006.1 (Monotone restriction).** A `ClearanceDecision` SHALL only ever further
  restrict access; it SHALL NOT grant access denied by the Security `AccessDecision`
  (AS-003 R7). Effective access = Security decision AND clearance decision; deny-override
  preserved.
- **INV-006.2 (Propagation floor).** Derived outputs SHALL be at least as restricted as
  their inputs under the default rule; a marking SHALL NOT be dropped without an explicit,
  audited declassification step.
- **INV-006.3 (Distinct concepts).** Marking/Clearance (entitlement-based access) SHALL
  remain distinct from Security `Classification` (sensitivity) and SHALL NOT alias it.
- **INV-006.4 (Auditability).** Marking assignment, propagation, declassification, and
  clearance denials SHALL be audited via the existing audit hash-chain (Art. VII).
- **INV-006.5 (Immutability).** Markings and clearance decisions SHALL be immutable once
  produced (AS-003 R9).

## Conformance Requirements

- **RUN-006/C1.** A clearance decision never grants what Security denied (monotone
  restriction).
- **RUN-006/C2.** Default propagation makes outputs at least as restricted as inputs.
- **RUN-006/C3.** Declassification requires an explicit, audited step.
- **RUN-006/C4.** Marking/clearance never reuses or aliases `DataClassification`.

## Related Specifications

RUN-000, RUN-001 (declares rule), RUN-002 (carriage), RUN-003 (context), RUN-008
(enforcement); consumes Security public contracts.

## Related ADRs

ADR-0005 (establishing); Constitution Art. V (governed attachment).

## Implementation Notes (non-normative)

- Markings MAY be expressed as policy `config` on existing `ObjectAccessPolicy` to reuse
  the established surface; a `ClearancePolicy` MAY reference `SecurityContext` attributes.
- `*Policy` names are qualified (`ClearancePolicy`); bare `Policy` SHALL NOT be exported.
- Open: clearance lattice and whether compartments/caveats are in scope v1 (RUN-000 OQ).
