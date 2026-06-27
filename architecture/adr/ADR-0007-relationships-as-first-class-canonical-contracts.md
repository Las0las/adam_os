# ADR-0007 — Relationships as first-class canonical contracts

| Field | Value |
|-------|-------|
| Identifier | ADR-0007 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | CONST-LAWRENCE v1.0 (Articles I, II, IV, VII); AS-005; ONT-001; ONT-002 |
| Supersedes | — |
| Superseded By | — |

## Title

Model relationships between canonical objects as first-class, versioned, governed
contracts rather than arbitrary graph edges.

## Status

Accepted.

## Context

ONT-001 made canonical *objects* (Candidate, Job, Submission, Account) governed
contracts. Their *relationships*, however, remained implicit: `linkObjects(ctx,
{ linkType, from, to })` accepts any `linkType` string between any two object
types, in any direction, with no statement of legality, direction, or cardinality.
The legal shape of the operating graph existed only as a side effect of which
strings callers happened to pass — the same weakness ONT-001 removed for objects.

Constitution Article I requires a single source of truth and Article VII requires
traceability. An ontology whose nouns are governed but whose verbs are ungoverned
is only half-specified: cross-domain edges (`about`, `for`) drift, inverse edges
go unrecorded, and cardinality expectations live only in developers' heads.

## Decision

1. **Relationships are first-class canonical contracts.** Each is defined once, in
   a strongly-typed registry (ONT-002), as a `RelationshipDefinition` carrying id,
   linkType, sourceType, targetType, inverse, cardinality, lifecycle, description,
   governance, and declared events/permissions/validation hooks.
2. **AS-005** is established as the governing Architecture Standard; **ONT-002** is
   its Normative Specification.
3. **Directionality, cardinality, and lifecycle** are part of the contract.
   Changing them on an existing relationship is breaking and requires an ADR;
   adding relationships is additive.
4. **Validation is warn-only** in this slice: `linkObjects` emits an
   `ontology.relationship.warning` audit event for unknown types, illegal
   source/target/direction, or cardinality breaches, but **always persists** the
   edge (fail-open). Enforcement (rejection) is explicitly deferred to a future
   ADR, mirroring ONT-001 → ADR-0006.
5. **Future-safe declaration** is permitted: relationships may name object types
   not yet implemented (Interview, Offer, Placement, Mission, Recommendation).
   Declaring them is not implementing them.

## Alternatives Considered

- **Leave relationships as free-form edges.** Rejected: violates Articles I/VII;
  guarantees graph drift and makes future enforcement impossible without first
  reconstructing intent.
- **Encode relationships only inside object schemas (extend ONT-001).** Rejected:
  conflates nouns and verbs, would widen ONT-001 (explicitly out of scope), and
  cannot express polymorphic edges (`about`, `for`) or inverses cleanly.
- **Enforce immediately (reject illegal edges).** Rejected: violates Article II
  (additive) and would change behavior for existing callers before a measured
  baseline. Warn-only first, enforce later by ADR.

## Consequences

- The legal object graph is now declared once and conformance-tested.
- Drift becomes observable (`ontology.relationship.warning`) without any behavior
  change; the live pack/demo surface validates clean (zero warnings).
- A later ADR can flip relationships to enforce-mode reusing this contract, exactly
  as ADR-0006 did for objects.
- Slight per-edge cost: `linkObjects` reads existing same-linkType edges to compute
  cardinality degrees (fail-open, warn-only).

## Compatibility Analysis

Fully additive and backward-compatible. `linkObjects`/`OntologyLink` signatures are
unchanged; the only new behavior is a best-effort warning audit event on
violation. No data migration. Dependency direction is preserved: ONT-002 depends
on the Constitution and AS-005; it references ONT-001 object types by name without
modifying ONT-001 (no widening). Fail-open guarantees no new failure path.

## Conformance Impact

New conformance suites (`tests/unit/ont-002-*`) prove registry well-formedness,
inverse symmetry, seed coverage, every validation class, warn-only/passthrough
behavior, and a zero relationship-warning baseline. A spec-governance test asserts
ONT-002 participates alongside ONT-001.

## Approval

Recorded by the LAWRENCE Architecture Council, 2026-06-27, establishing AS-005 and
ONT-002 with warn-only relationship validation.
