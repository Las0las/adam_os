# ONT-001 — Canonical Object Model

<!--
  Normative Specification (Ontology family). Follows the LAWRENCE specification
  template and RFC-2119 terminology (SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY).
  A specification is an ARCHITECTURAL artifact — it defines contracts and
  invariants, not implementation detail. This is a DRAFT: it documents the
  canonical object model as it exists today and fixes the contract going forward.
  It does NOT yet mandate runtime enforcement (see Conformance Requirements §C
  and the companion design note architecture/design/canonical-schema-registry.md).
-->

| Field | Value |
|-------|-------|
| Identifier | ONT-001 |
| Version | 1.0 |
| Status | Draft |
| Authority | Normative Specification (Ontology family) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | LAWRENCE Constitution v1.0; AS-004 (proposed — Canonical Ontology & Domain Runtime, pending); IOS-017 (Canonical Object Contract precedent) |

> **Governance note.** The IOS/RUN specification families derive from AS-001
> (Inference Operating System). ONT-001 governs the **business ontology** — the
> canonical objects that represent staffing/recruiting reality — which AS-001
> does **not** cover. Until the governing Architecture Standard **AS-004** is
> ratified, ONT-001 derives authority directly from the Constitution and is held
> at **Draft**. Ratifying AS-004 and promoting ONT-001 to Active SHALL proceed
> through an ADR (Constitution Article VI).

## Purpose

The ontology is LAWRENCE's operating surface: every domain workflow, action,
recommendation, projection, and audit record refers to canonical objects, not to
import rows or UI state. Today those objects exist as a generic property-bag
graph (`OntologyObject { objectType: string; properties: Record<string, unknown> }`,
`src/lib/dataops/ontology/object-service.ts`). `objectType` is an unconstrained
string and `properties` is untyped, so the most important nouns in the system —
**Candidate, Job, Submission, Account** — have weaker structural guarantees than
the model-cache layer governed by IOS-007.

ONT-001 satisfies the constitutional need for **one authoritative definition of
each canonical object** (Constitution Article I — single source of truth;
Article VII — traceability). It fixes each object's identity, required shape,
lifecycle states, and relationship edges so that producers, consumers, surfaces,
and conformance suites depend on a stable contract rather than on whatever a
given importer happened to write.

## Scope

**Governed by this specification:**

1. The canonical object **identity model** — `objectType`, `externalKey`, and the
   idempotency key `(objectType, externalKey)`.
2. The canonical **schema** (required and optional properties, and status domain)
   for the four foundational objects: **Candidate, Job, Submission, Account**.
3. The canonical **lifecycle/state** for each (the legal `status` values).
4. The canonical **relationship graph** (the legal `linkType` edges between these
   objects, and their direction).

**Explicitly NOT governed here (future ONT specs):**

- Other object types currently present in seed/demo packs (`RecruiterNote`,
  `Opportunity`, `OnboardingCase`, `SupportTicket`, `ValidationCase`, `RiskSignal`,
  `Interview`, `Offer`, `Placement`, `BenchResource`, `Mission`, `Forecast`).
  These remain valid generic objects until specified.
- Object **actions** (governed by the Mission Control action contract,
  `src/lib/mission-control/actions/action-service.ts`).
- Object **surfaces/projections** (the universal object surface).
- **Runtime enforcement** of the schema (warn-then-enforce; see §C and the
  companion design note).

## Responsibilities

A conformant ontology implementation SHALL:

1. Treat `(objectType, externalKey)` as the idempotent merge identity for a
   canonical object; re-ingesting the same logical entity SHALL merge, not
   duplicate (as `upsertObject` does today).
2. Persist for each canonical object exactly the **status domain** defined in §
   *Lifecycle* and reject — or, in Draft warn-mode, flag — values outside it.
3. Preserve provenance and append-only ledgers without mutating prior entries
   (the existing `appendLedger` contract).
4. Record every create/update as an immutable audit event
   (`ontology.object.create` / `ontology.object.update`).
5. Only create relationship edges whose `linkType` and endpoint object types are
   defined in §*Relationship Graph*.

## Public Interfaces

The stable contract consumers depend on (described normatively; the authoritative
TypeScript lives at `src/types/dataops.ts` and is realized by
`src/lib/dataops/ontology/object-service.ts`):

- `OntologyObject` — `{ id, tenantId, objectType, externalKey, title, status,
  properties, createdAt, updatedAt }`.
- `OntologyLink` — `{ id, tenantId, linkType, fromObjectType, fromObjectId,
  toObjectType, toObjectId, properties?, createdAt }`.
- `upsertObject(ctx, UpsertObjectInput)` — idempotent create/merge on
  `(objectType, externalKey)`.
- `linkObjects(ctx, …)` — idempotent edge creation on
  `(linkType, fromObjectId, toObjectId)`.

ONT-001 does not change these signatures. It constrains the **values** they carry
for the four canonical objects.

### Canonical object: Candidate

| Aspect | Contract |
|--------|----------|
| `objectType` | `"Candidate"` |
| `externalKey` | source candidate key; falls back to `email` then `fullName` (legacy CSV path) |
| `title` | `fullName ?? email ?? externalKey` |
| Required properties | `fullName \| email` (at least one SHALL be present) |
| Optional properties | `source, phone, location, headline, currentTitle, currentCompany, profileUrl, education, summary, provenance, imports[]` |

### Canonical object: Job

| Aspect | Contract |
|--------|----------|
| `objectType` | `"Job"` |
| `externalKey` | source job key (e.g. ATS job id) |
| `title` | `title ?? externalKey` |
| Required properties | `title` (SHALL be present; defaults to `externalKey`) |
| Optional properties | `source, url, externalIds[], atsJobId, location, compensation, hiringProject, contract, provenance, imports[]` |

### Canonical object: Submission

A Submission is a **first-class lifecycle object**, not a mere edge, so it may
accumulate interview history, scores, offers, and communications over time.

| Aspect | Contract |
|--------|----------|
| `objectType` | `"Submission"` |
| `externalKey` | source submission/application key |
| `title` | `"<candidate> → <job>"` |
| Required properties | `jobKey, candidateKey, stage` |
| Optional properties | `source, appliedAt, rawStage, screeningAnswers, score, provenance, imports[]` |

### Canonical object: Account

Accounts model **clients** in the staffing target.

| Aspect | Contract |
|--------|----------|
| `objectType` | `"Account"` |
| `externalKey` | client/account key |
| `title` | account/client name |
| Required properties | `title` |
| Optional properties | `industry, owner, segment, value, evidence[]` (free until a future ONT spec tightens) |

## Lifecycle

`status` is part of the contract. The canonical domains:

- **Candidate.status** — initial `"new"`; SHOULD reflect the candidate's furthest
  pipeline position. Recognized: `new`, `active`, `placed`, `archived`.
- **Job.status** — `open`, `on_hold`, `filled`, `closed`, `cancelled`. Initial
  `"open"`.
- **Submission.status** — SHALL be a `CandidateStage` (the canonical pipeline
  lifecycle, `src/types/domain.ts`):
  `new → screen → submitted → interview → offer → placed`, with terminal
  `rejected`. `rawStage` SHALL preserve the source label verbatim; unknown source
  labels SHALL normalize to `new` (never lost).
- **Account.status** — `active`, `prospect`, `at_risk`, `churned`, `inactive`.
  Initial `"active"`.

Lifecycle **transition guards** (which transitions are legal) are intentionally
NOT specified here; they are deferred to ONT-003 (State & Transitions). ONT-001
fixes only the legal value domain.

## Relationship Graph

Canonical edges among the four objects (direction is `from ──linkType──► to`):

| `linkType` | from | to | Meaning |
|------------|------|----|---------|
| `submitted` | Candidate | Submission | the candidate produced this submission |
| `targets` | Submission | Job | the submission is against this job |
| `for` | (work object) | Account | object belongs to a client account |
| `about` | (note/artifact) | (any) | annotation/reference edge |

The canonical recruiting sub-graph is therefore:

```
Candidate ──submitted──► Submission ──targets──► Job
                                              (Job ──for──► Account, when known)
```

Edges `draft_for`, `finding_of` exist in adjacent domains (support/claims) and are
governed by their future ONT specs, not here. A conformant implementation SHALL
NOT introduce a new `linkType` between two canonical objects without a spec
revision.

## Canonical Object Contract

<!-- Mirrors the IOS-017+ Canonical Object Contract convention, adapted for the
     ontology family. -->

- **Canonical Objects Consumed** (read by reference, never mutated): the
  normalized import IR (`RecruitingSubmissionRecord`, IR Job/Candidate/Submission
  from `src/lib/dataops/import/recruiting-ir.ts`) — read by the object mapper to
  project into the ontology. ONT-001 does not own the IR.
- **Canonical Objects Produced**: **Candidate, Job, Submission, Account** — ONT-001
  is their canonical definition authority. Their concrete *instances* are produced
  by authorized producers (below) via `upsertObject`; ONT-001 owns the **schema**,
  not the act of production.
- **Existing Contracts Reused**: `upsertObject` / `linkObjects` (object-service);
  the `appendLedger` provenance contract; `emitAudit`; the `CandidateStage` type
  (`src/types/domain.ts`); `requirePermission("ontology.admin")`.
- **Authoritative Producers** (who may write these objects):
  - **DataOps import projection** (`recruiting-ir-projection.ts`, via the
    `recruiting` object mapper) — Candidate, Job, Submission.
  - **Domain seed/demo packs** (`src/lib/domains/**`) — Account and demo instances.
  - The **governed `update_ontology_object` action** — status/property updates
    under the action pipeline.
  No other path SHALL write canonical objects directly.
- **Authorized Consumers**: command-center, object-detail surfaces, domain
  workflow/dashboard services, recommendation functions, and recruiting
  repositories MAY read these objects. Consumers SHALL NOT mutate them outside the
  authorized-producer paths above.

## Invariants

1. **Single identity** — a canonical object is uniquely identified by
   `(tenantId, objectType, externalKey)`; `upsertObject` SHALL merge on it.
2. **Tenant isolation** — every object and link SHALL carry `tenantId`; reads
   SHALL be tenant-scoped.
3. **Append-only provenance** — `imports[]` and other ledgers SHALL only grow;
   prior entries SHALL NOT be mutated or dropped.
4. **Status within domain** — `status` SHALL be a member of the object's lifecycle
   domain (§Lifecycle). (Draft: violations are flagged, not rejected — see §C.)
5. **Required shape** — each canonical object SHALL satisfy its Required
   properties (§Public Interfaces). (Draft: flagged, not rejected.)
6. **Closed relationship set** — only the `linkType`/endpoint combinations in
   §Relationship Graph SHALL connect canonical objects.
7. **Auditability** — every create/update SHALL emit an immutable audit event.

## Dependencies

- LAWRENCE Constitution v1.0 (Articles I, II, VII).
- AS-004 — Canonical Ontology & Domain Runtime (**proposed**, pending ratification).
- `src/types/domain.ts` (`CandidateStage`) — the canonical pipeline lifecycle.

ONT-001 depends on no lower layer and SHALL NOT depend on any IOS/RUN
specification (authority direction, Constitution Article I §4).

## Conformance Requirements

A conformant implementation SHALL satisfy the following. Each maps to a future
conformance suite under `tests/unit/` / `conformance/ontology/`.

**§A — Identity & provenance (enforceable today; already realized)**

- A1. Re-ingesting the same `(objectType, externalKey)` merges into one object.
- A2. `imports[]` ledger entries are deduped by `importRunId` and never shrink.
- A3. Every create/update emits the corresponding `ontology.object.*` audit event.

**§B — Relationship integrity (enforceable today)**

- B1. Only `linkType`/endpoint pairs from §Relationship Graph connect canonical
  objects; `linkObjects` is idempotent on `(linkType, from, to)`.

**§C — Schema & lifecycle (Draft: WARN-ONLY, not yet enforced)**

- C1. Each canonical object's required properties are present.
- C2. `status` is within the object's lifecycle domain.
- C3. Validation runs **inside `upsertObject`** and, in Draft, **emits a warning
  signal** (audit/log) on violation **without rejecting** the write — preserving
  all existing functionality. Promotion to reject-mode SHALL require an ADR and
  promotion of ONT-001 to Active. The mechanism is specified in the companion
  design note `architecture/design/canonical-schema-registry.md`.

**§D — Canonical Object Contract conformance (mandatory)**

- D1. **Authority** — Candidate/Job/Submission/Account schemas are defined ONLY by
  ONT-001; no other spec redefines them.
- D2. **No authority inversion** — a consumer (surface, recommendation, workflow)
  SHALL NOT mutate a canonical object outside the authorized-producer paths.
- D3. **Dependency direction** — ONT-001 SHALL NOT depend on IOS/RUN specs.
- D4. **Read-only consumption of the IR** — projection SHALL NOT mutate the import
  IR it reads.

## Related ADRs

- (none yet) — promotion to Active and ratification of AS-004 SHALL be recorded as
  an ADR.

## Derived From

- LAWRENCE Constitution v1.0
- AS-004 Canonical Ontology & Domain Runtime (proposed)

## Superseded By

—

## Implementation References

<!-- Descriptive, not authoritative: the specification governs the code. -->

- `src/types/dataops.ts` — `OntologyObject`, `OntologyLink`.
- `src/lib/dataops/ontology/object-service.ts` — `upsertObject`, `linkObjects`,
  `applyLedgers`, audit emission.
- `src/lib/dataops/ontology/recruiting-object-mapper.ts` — Candidate projection.
- `src/lib/dataops/import/recruiting-ir-projection.ts` — Candidate/Submission/Job
  sub-graph projection and edges.
- `src/lib/dataops/import/recruiting-ir.ts` — IR shapes; `CandidateStage`
  normalization.
- `src/types/domain.ts` — `CandidateStage` lifecycle.
- `src/lib/domains/executive/executive-seed-pack.ts`,
  `src/lib/domains/commercial/commercial-pack.ts` — Account instances.
