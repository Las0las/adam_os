# ADR-0008 — Relationship enforce-mode (opt-in, fail-closed)

| Field | Value |
|-------|-------|
| Identifier | ADR-0008 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | CONST-LAWRENCE v1.0 (Articles II, IV); AS-005; ONT-002; ADR-0006 (object enforce-mode precedent); ADR-0007 |
| Supersedes | — |
| Superseded By | — |

## Title

Add opt-in, fail-closed enforcement for canonical relationships, parallel to the
object schema enforcement of ADR-0006.

## Status

Accepted.

## Context

ADR-0007 established canonical relationships (AS-005 / ONT-002) with **warn-only**
validation in `linkObjects`. ADR-0006 had already introduced opt-in, fail-closed
enforcement for canonical *objects* (default warn; `enforce` rejects invalid
registered objects). Relationships should reach the same readiness: operators who
want a fail-closed guarantee on the object *graph* (not just the nodes) need a way
to reject invalid registered edges — without changing default behavior for anyone
else, and without coupling relationship enforcement to object enforcement.

The VS-003 baseline is clean (zero relationship warnings across all pack installs
and demos), so enforcement can be made available safely.

## Decision

1. **Relationship validation gains an enforcement mode**, resolved per tenant
   (precedence: per-tenant → global → env `ONTOLOGY_RELATIONSHIP_ENFORCEMENT` →
   default), independent of object enforcement.
2. **Default is always `warn`** — `linkObjects` behavior is unchanged unless an
   operator explicitly enables enforcement.
3. In **enforce** mode, an **invalid REGISTERED relationship** (a known `linkType`
   used with an illegal source/target/direction, or a cardinality breach) SHALL
   emit `ontology.relationship.rejected` and throw `RelationshipSchemaError`
   **before persistence** (fail-closed).
4. **Unregistered relationship types are NOT rejected.** An unknown `linkType`
   continues to only warn (`unknown_relationship_type`) and persist, in both
   modes. Enabling enforcement therefore never breaks edges the registry does not
   yet model — mirroring how object enforcement ignores unregistered objectTypes.
5. **No new object types, no lifecycle enforcement, no UI, no migration.** This is
   additive plumbing only.

## Alternatives Considered

- **Reject unregistered relationship types in enforce mode.** Rejected: would make
  enabling enforcement a breaking change for any not-yet-registered edge and
  diverges from the object-enforcement precedent (unregistered = unaffected).
- **Share one enforcement flag with object enforcement.** Rejected: operators may
  want object integrity without relationship integrity (or vice versa); a separate
  `ONTOLOGY_RELATIONSHIP_ENFORCEMENT` keeps them independent and additive.
- **Enforce by default now that the baseline is clean.** Rejected: violates
  Article II; enforcement must be explicitly opted into.

## Consequences

- Operators can opt a tenant (or the platform) into fail-closed graph integrity for
  registered relationships.
- Default behavior is unchanged; warn-mode tenants are unaffected.
- Callers of `linkObjects` under enforce mode must handle `RelationshipSchemaError`
  for invalid registered edges. Under the default warn mode there is no new failure.

## Compatibility Analysis

Additive and backward-compatible. `linkObjects`/`OntologyLink` signatures unchanged;
the new mode defaults off; unregistered types are never rejected; validation infra
errors fail open. No data migration. Dependency direction preserved.

## Conformance Impact

ONT-002 §Validation is extended to describe warn-vs-enforce behavior. New suite
`tests/unit/ont-002-relationship-enforcement.test.ts` proves: warn persists+warns
invalid registered edges; enforce rejects them pre-persistence with
`RelationshipSchemaError`; unregistered types are never rejected; valid edges pass
in both modes; per-tenant override isolation; cardinality breach rejection.

## Approval

Recorded by the LAWRENCE Architecture Council, 2026-06-27, authorizing opt-in
relationship enforcement parallel to ADR-0006.
