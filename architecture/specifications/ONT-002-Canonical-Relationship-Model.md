# ONT-002 — Canonical Relationship Model

<!--
  Normative Specification (Ontology family). RFC-2119 terminology. Governs
  canonical relationships between objects. ACTIVE: runtime validation is warn by
  default; opt-in fail-closed enforce mode is available (ADR-0008), mirroring
  ONT-001's warn-then-enforce posture.
-->

| Field | Value |
|-------|-------|
| Identifier | ONT-002 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification (Ontology family) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | LAWRENCE Constitution v1.0; AS-005 (Canonical Relationship Architecture); ONT-001 (Canonical Object Model); ADR-0007 |

## Purpose

Relationships are how canonical objects compose into the LAWRENCE operating graph:
`Candidate ──submitted──▶ Submission ──targets──▶ Job ──for──▶ Account`. Today
edges are created by passing free `linkType` strings to `linkObjects`, with no
authoritative statement of which edges are legal, in which direction, or with what
cardinality. ONT-002 elevates relationships to **first-class, versioned, governed
contracts** — the verb counterpart to ONT-001's nouns — satisfying Constitution
Article I (single source of truth) and Article VII (traceability).

## Principles

1. **Relationships are contracts, not edges.** A relationship has identity,
   direction, cardinality, lifecycle, and governance — not just a string.
2. **One authoritative definition.** Each relationship is defined once, in the
   registry, as a strongly-typed `RelationshipDefinition`.
3. **Additive evolution.** New relationships are added freely; changing an
   existing one's direction/cardinality/endpoints is breaking (ADR required).
4. **Observe before enforce.** Validation is warn-only in this slice; it never
   blocks edge creation (Constitution Article IV — observation SHALL NOT change
   execution).
5. **Declaring ≠ implementing.** `planned` relationships may name object types
   that do not exist yet; they carry no implementation obligation.

## Relationship identity

A relationship is identified by a stable **`id`** (its canonical name, e.g.
`candidate_submitted_submission`) and persists edges under a wire **`linkType`**
on `OntologyLink`. A `linkType` MAY be **polymorphic** — several relationship
definitions may share one linkType across different `(sourceType, targetType)`
pairs (e.g. `for`, `about`). The triple `(linkType, sourceType, targetType)`
resolves to at most one definition.

## Directionality

Every relationship is **directed**: `sourceType → targetType`. Direction is
significant; `A --R--> B` is distinct from `B --R--> A`. A relationship MAY
declare an **`inverseRelationship`** (the id of the reverse definition). When
declared, the inverse SHALL be mutual and SHALL flip the endpoints
(`onboarding_case_has_task` ↔ `onboarding_task_for_case`).

## Source object

The `sourceType` is the canonical object type at the `from` endpoint. It is a type
name (string), which MAY reference an ONT-001 object, a not-yet-canonical object
(e.g. `Recruiter`), or a `planned` future type (e.g. `Interview`).

## Target object

The `targetType` is the canonical object type at the `to` endpoint, under the same
rules as the source.

## Cardinality

| Cardinality | Source side | Target side |
|-------------|-------------|-------------|
| `one_to_one` | ≤1 target per source | ≤1 source per target |
| `one_to_many` | many targets per source | ≤1 source per target |
| `many_to_one` | ≤1 target per source | many sources per target |
| `many_to_many` | unbounded | unbounded |

Cardinality is checked **where practical** against existing-edge degree counts at
creation time (warn-only).

## Required metadata

Every `RelationshipDefinition` SHALL declare: `id`, `linkType`, `sourceType`,
`targetType`, `cardinality`, `lifecycle`, `description`, and `governance`
(`owner`, `since`, `stability`).

## Optional metadata

`inverseRelationship` (id or null), `validationHooks` (declared pure extension
hooks), `emittedEvents` (declared event names), and `permissions` (declared
`create`/`remove` permission keys). In VS-003 events/permissions/hooks are
**declarative only** — they document intent and are not yet enforced or emitted
beyond the existing `ontology.admin` guard and the warn event.

## Relationship lifecycle

The lifecycle describes the **contract**, not instance state:

- **active** — in use today; endpoints are live object types.
- **planned** — declared and future-safe; endpoint types may not exist yet.
- **deprecated** — retained for compatibility; SHOULD NOT be used for new edges.

## Relationship invariants

1. **Unique id** — each definition's `id` SHALL be unique.
2. **Typed contract** — definitions SHALL be strongly typed; no stringly-typed
   registry entries.
3. **Mutual inverse** — a declared `inverseRelationship` SHALL resolve to a
   registered definition whose own inverse points back and whose endpoints are
   flipped.
4. **Directionality is fixed** — a relationship's `(sourceType → targetType)` and
   `cardinality` SHALL NOT change except via ADR (breaking change).
5. **Idempotent edges** — creating an already-existing `(linkType, from, to)` edge
   SHALL be a no-op and SHALL NOT warn.

## Validation rules

On creation/update of an edge `(linkType, sourceType, targetType)`:

- **unknown_relationship_type** — no definition uses this `linkType`.
- **invalid_direction** — the reverse pair is defined but not this one.
- **invalid_source** — the `targetType` is valid for the linkType but the
  `sourceType` is not.
- **invalid_target** — the `sourceType` is valid for the linkType but the
  `targetType` is not.
- **illegal_source_target** — neither endpoint matches any definition of the
  linkType.
- **cardinality** — the new edge would breach the matched definition's cardinality
  (checked where practical).

Validation is **total** — it never throws. The effect of a finding depends on the
tenant's relationship enforcement mode (ADR-0008; default **warn**):

- **warn** (DEFAULT): emit an `ontology.relationship.warning` audit event and
  persist the edge (fail-open). Unchanged baseline behavior.
- **enforce** (opt-in: per-tenant → global → env `ONTOLOGY_RELATIONSHIP_ENFORCEMENT`):
  for an invalid **registered** relationship (known `linkType`, illegal
  source/target/direction or cardinality breach), emit
  `ontology.relationship.rejected` and throw `RelationshipSchemaError` **before
  persistence** (fail-closed). **Unregistered** relationship types
  (`unknown_relationship_type`) are NEVER rejected — they only warn in both modes,
  so enabling enforcement never breaks edges the registry does not yet model.

## Versioning strategy

ONT-002 is versioned (v1.0). Adding a new relationship or marking one
`deprecated` is additive (minor). Changing an existing relationship's direction,
cardinality, or endpoints is breaking and SHALL be recorded in an ADR with a
version increment. `governance.since` records the ONT-002 version that introduced
each definition.

## Governance

The Architecture Council owns the registry (AS-005). Definitions carry
`governance.owner` and `governance.stability` (`stable` / `experimental`).
Enforcement is **opt-in and off by default** (ADR-0008): rejecting invalid
registered edges happens only when a tenant/global/env override sets `enforce`.
Unregistered relationship types are never rejected.

## ADR references

- **ADR-0007** — Relationships as first-class canonical contracts (establishes
  ONT-002, AS-005, the registry, and warn-only validation).
- **ADR-0008** — Relationship enforce-mode (opt-in, fail-closed; default warn;
  parallel to the object enforcement of ADR-0006).

## Conformance requirements

A conformant implementation SHALL satisfy (suites under `tests/unit/`):

- **§A Registry well-formedness** — every definition has the required fields;
  ids are unique; cardinality/lifecycle values are legal.
- **§B Inverse symmetry** — declared inverses are mutual and flip endpoints.
- **§C Seed coverage** — the required seed relationships are registered (Candidate→
  Submission, Submission→Job, Candidate→Account, Job→Account, Candidate→Recruiter,
  Submission→Recruiter, and the planned Submission→Interview, Interview→Offer,
  Offer→Placement, Mission→Recommendation).
- **§D Validation classes** — each of unknown type, invalid source, invalid
  target, invalid direction, illegal pair, and cardinality is detected; valid
  edges produce none.
- **§E Warn integration** — in warn mode `linkObjects` emits
  `ontology.relationship.warning` on violation yet always persists; unknown types
  pass through; re-linking is idempotent and silent; the full pack/demo surface
  yields a **zero** relationship warning baseline.
- **§F Enforce integration** (ADR-0008) — in enforce mode `linkObjects` rejects an
  invalid **registered** relationship before persistence with
  `RelationshipSchemaError` (emitting `ontology.relationship.rejected`); valid
  edges pass; **unregistered** relationship types are never rejected; the mode
  resolves per tenant (per-tenant → global → env → default warn).

## Implementation references

- `src/lib/dataops/ontology/relationships/types.ts` — typed contracts.
- `src/lib/dataops/ontology/relationships/definitions.ts` — seed definitions.
- `src/lib/dataops/ontology/relationships/registry.ts` — typed lookups.
- `src/lib/dataops/ontology/relationships/enforcement.ts` — mode resolution (ADR-0008).
- `src/lib/dataops/ontology/relationships/errors.ts` — `RelationshipSchemaError`.
- `src/lib/dataops/ontology/relationships/validate.ts` — pure validation.
- `src/lib/dataops/ontology/object-service.ts` — warn-only integration in
  `linkObjects` (`ontology.relationship.warning`).

## Derived From

- LAWRENCE Constitution v1.0
- AS-005 Canonical Relationship Architecture

## Superseded By

—
