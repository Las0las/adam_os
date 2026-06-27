# ADR-0006 — Promote ONT-001 to Active and establish canonical schema enforcement

| Field | Value |
|-------|-------|
| Identifier | ADR-0006 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | CONST-LAWRENCE v1.0 (Article VI); ONT-001 Canonical Object Model; architecture/design/canonical-schema-registry.md; ASSESS-002 |
| Supersedes | — |
| Superseded By | — |

## Title

Promote ONT-001 from Draft to Active and introduce opt-in, fail-closed canonical
object schema enforcement (reject-mode).

## Status

Accepted.

## Context

ONT-001 (Canonical Object Model) defined the canonical schema, lifecycle status
domain, and relationship model for Candidate, Job, Submission, and Account, and
was held at **Draft** pending the warn-then-enforce rollout described in
`architecture/design/canonical-schema-registry.md`. The design note made
enforcement conditional on a measured baseline:

> "Switching to `enforce` SHALL NOT happen until the warn-mode baseline shows a
> zero (or explicitly-accepted) violation rate across importers/seeds."

That precondition is now met. **ASSESS-002** records the measured baseline:
installing every domain pack and running every demo produced **zero**
`ontology.schema.warning` events after the recruiting seed-Candidate fix, locked
in by a regression guard (`tests/unit/ont-001-warn-baseline.test.ts`). The
canonical types are therefore drift-free across the entire seed/demo surface.

Constitution Article VI requires that a change establishing or amending
architecture proceed through Specification → ADR → Approval → Conformance, and
that promoting a specification be recorded as an ADR. This ADR is that record.

## Decision

1. **ONT-001 is promoted from Draft to Active.** Its canonical schemas,
   lifecycle status domains, and relationship model are now normative.
2. **Canonical schema validation gains an enforcement mode.** `upsertObject`
   resolves an enforcement mode per tenant:
   - **warn** (DEFAULT): on violation of a *registered* canonical type, emit an
     `ontology.schema.warning` audit event and persist the write unchanged
     (observe-only, fail-open). This is the unchanged prior behavior.
   - **enforce**: on violation of a *registered* canonical type, emit an
     `ontology.schema.rejected` audit event and throw `OntologySchemaError`
     **before persistence** (fail-closed). The write does not occur.
3. **Enforcement SHALL be opt-in.** The default is always warn. Enforcement is
   enabled only by an explicit operator action: globally via the
   `ONTOLOGY_SCHEMA_ENFORCEMENT=enforce` environment variable or a programmatic
   global override, or per tenant via a programmatic per-tenant override.
   Resolution precedence: per-tenant → global → env → default(warn).
4. **Unregistered object types are unaffected in both modes.** Only Candidate,
   Job, Submission, and Account are validated; no other type is enforced.
5. **No new canonical objects, no lifecycle/transition enforcement, and no
   migration** are introduced by this ADR.

## Alternatives Considered

- **Enforce globally by default.** Rejected: violates Constitution Article II
  (additive evolution) — it would change behavior for every existing tenant
  without opt-in, and risks rejecting writes from any not-yet-measured producer.
- **Persist per-tenant mode in the database now.** Deferred: a process-level
  control surface (env + programmatic overrides) is sufficient to enable
  enforcement and is fully additive. DB-backed per-tenant configuration is a
  future additive step requiring no contract change.
- **Keep warn-only indefinitely.** Rejected: with a proven zero baseline, leaving
  enforcement permanently optional would let future drift persist silently;
  reject-mode gives operators a fail-closed guarantee when they want it.

## Consequences

- Operators can opt a tenant (or the platform) into fail-closed canonical
  integrity; malformed Candidate/Job/Submission/Account writes are rejected at
  the single sanctioned write path (`upsertObject`).
- Default behavior is unchanged: warn-mode tenants behave exactly as before.
- Callers of `upsertObject` for registered types under enforce mode must handle
  `OntologySchemaError`. Under the default warn mode there is no new failure mode.
- Lifecycle/transition guards and additional canonical types remain future work.

## Compatibility Analysis

Additive and backward-compatible. The change introduces a new, default-off mode;
no existing contract, signature, or default behavior changes. Dependency
direction is preserved (ONT-001 depends only on the Constitution; the enforcement
module lives beside the schema registry and is consumed by `object-service`).
Fail-closed behavior occurs only when explicitly enabled. No data migration.

## Conformance Impact

- ONT-001 §C is revised from "warn-only (future enforcement)" to "warn by
  default; enforce when explicitly enabled".
- New conformance coverage (`tests/unit/ont-001-enforcement.test.ts`): warn mode
  still persists invalid registered objects with a warning; enforce mode rejects
  them before persistence with `OntologySchemaError`; unregistered types are
  unaffected in enforce mode; valid canonical objects pass in both modes;
  per-tenant enforcement does not leak across tenants.
- The zero warn-baseline guard (`tests/unit/ont-001-warn-baseline.test.ts`)
  remains green.

## Approval

Recorded by the LAWRENCE Architecture Council, 2026-06-27, as the governance
decision promoting ONT-001 to Active and authorizing opt-in schema enforcement.
