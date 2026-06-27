# ASSESS-002 — ONT-001 Warn-Baseline (pre-enforcement evidence)

| Field | Value |
|-------|-------|
| Identifier | ASSESS-002 |
| Version | 1.0 |
| Status | Assessment (non-normative) |
| Authority | Pre-enforcement evidence for ONT-001 §C |
| Owner | LAWRENCE Architecture Council |
| Date | 2026-06-27 |
| Subject | Measured `ontology.schema.warning` volume across all domains |
| Related Artifacts | ONT-001-Canonical-Object-Model.md; architecture/design/canonical-schema-registry.md |

> This is an **assessment / measurement only**. It records the warn-only schema
> validation baseline that ONT-001 §C and the schema-registry design note require
> *before* enforcement (reject-mode) may be considered. Promotion of ONT-001 to
> Active and the introduction of reject-mode remain gated behind a separate ADR.

---

## 1. Why this exists

ONT-001 §C adopts a **warn-then-enforce** rollout: canonical-object validation
runs inside `upsertObject` in warn-only mode, emitting an `ontology.schema.warning`
audit event on violation without ever blocking a write. The design note
(`architecture/design/canonical-schema-registry.md` §2.4) makes enforcement
conditional on a measured baseline: *"Switching to `enforce` SHALL NOT happen
until the warn-mode baseline shows a zero (or explicitly-accepted) violation rate
across importers/seeds."* This document is that measurement.

## 2. Method

A measurement harness exercised every real producer path against the in-memory DB
(no Postgres), then aggregated every `ontology.schema.warning` event across all
tenants:

- Installed **all 7 domain-pack manifests**: `claims`, `executive-commercial`
  (as `executive`), `healthcare_ops`, `onboarding`, `professional_services`,
  `recruiting`, `support`.
- Ran **all 7 demo scenarios** (one per pack), e.g.
  `recruiting/hot-job-to-shortlist`, `executive/account-risk-to-decision-memo`.
- Grouped warnings by `objectType :: violation code (path)` and by offending
  object (`objectType:externalKey`).

Only the four registered canonical types (Candidate, Job, Submission, Account) are
validated; all other object types are unvalidated by design until a future ONT
spec registers them, so they cannot contribute warnings.

## 3. Baseline — before the seed fix

**Total: 4 warnings — one violation type, one producer.**

| objectType :: violation (path) | count |
|---|---|
| `Candidate :: required (properties.fullName)` | 4 |

| Offending object | count |
|---|---|
| `recruiting Candidate:cand-marcus` | 2 |
| `recruiting Candidate:cand-priya` | 2 |

Root cause: the two recruiting **seed** Candidates were declared with
`properties: {}` — their name was carried only in the top-level `title`, while
ONT-001 requires `fullName | email` *in properties*. Each warned twice (once on
the seed `create`, once on a subsequent demo `update`).

Everything else was already clean:

- **Accounts** (executive `acct-meridian`, commercial `acct-1`) — valid status
  (`active`) and title present.
- **Jobs** and **Submissions** across seed, import-projection, NL-extraction, and
  the (already-reconciled) shortlist action — all conformant.
- claims / support / onboarding / healthcare / professional-services packs produce
  object types not yet registered (`OnboardingCase`, `SupportTicket`,
  `ValidationCase`, `Opportunity`, …) — not validated, zero warnings.

### Producers verified statically (not exercised by packs/demos)

These run on import flows rather than pack install, and were confirmed conformant
by inspection (in-domain status + required fields present):

- `src/lib/dataops/import/recruiting-ir-projection.ts` (Candidate/Job/Submission)
- `src/lib/dataops/import/nl/candidate-extraction.ts` (Candidate)
- `src/lib/dataops/import/nl/job-extraction.ts` (Job)

## 4. Baseline — after the seed fix (this change)

The two recruiting seed Candidates now carry `fullName` (+ `email`) in
`properties` (`src/lib/domains/recruiting/recruiting-seed-pack.ts`).

**Total: 0 `ontology.schema.warning` events** across all pack installs and demos.

This zero baseline is locked in by a regression guard,
`tests/unit/ont-001-warn-baseline.test.ts`, which installs every manifest, runs
every demo, and asserts zero schema warnings.

## 5. Implication for enforcement

With a zero baseline across the entire seed/demo surface, flipping the registered
canonical types to reject-mode would break none of the exercised producers. The
remaining precondition is governance, not code: an **ADR promoting ONT-001 from
Draft to Active** and introducing the `enforce` mode flag + typed
`OntologySchemaError` (design note §2.4). Reject-mode is intentionally **not**
implemented here.

## 6. Reproducing

The measurement harness was a throwaway script (not committed). The committed
regression test `tests/unit/ont-001-warn-baseline.test.ts` reproduces the
post-fix result (0 warnings) and will fail if any future producer drifts from a
registered canonical contract.
