# Design Note — Canonical Object Schema Registry (warn-only)

| Field | Value |
|-------|-------|
| Status | Proposal (design only — no code in this pass) |
| Owner | LAWRENCE Architecture Council |
| Date | 2026-06-27 |
| Governs | Realization of ONT-001 §C (Schema & lifecycle conformance) |
| Related | ONT-001-Canonical-Object-Model.md; IOS-017 Canonical Object Contract precedent; `tests/unit/architecture-spec-governance.test.ts` |

> This note proposes **how** ONT-001's schema/lifecycle contract becomes a
> runtime check, in a strictly additive, behavior-preserving way. It changes no
> code. It reuses the IOS-017 governance pattern (a contract is real only when a
> conformance test proves it) and the existing audit pipeline as the warn channel.
> Nothing here authorizes modifying `object-service.ts` behavior; that is a later,
> separately-reviewed pass.

---

## 1. Problem

`upsertObject` accepts `objectType: string` and `properties: Record<string, unknown>`
with no structural check (`src/lib/dataops/ontology/object-service.ts`). The four
canonical objects (ONT-001) thus have no enforced shape or lifecycle. We want a
single, declared, testable source of truth for their schemas — without breaking
any current importer, seed pack, or action, all of which write today and SHALL
keep working.

The chosen rollout is **warn-then-enforce**: introduce validation that *observes
and reports* violations first (Draft), and only later — behind an ADR — *rejects*
them (Active). This mirrors Constitution Article II (additive evolution) and keeps
the change reversible.

## 2. Design overview

Three additive pieces, none of which alter existing call signatures or control
flow when no schema is registered:

```
src/lib/dataops/ontology/schemas/
  registry.ts          // objectType -> CanonicalObjectSchema (Zod-backed)
  candidate.schema.ts  // ONT-001 Candidate
  job.schema.ts        // ONT-001 Job
  submission.schema.ts // ONT-001 Submission
  account.schema.ts    // ONT-001 Account
  validate.ts          // pure validateCanonicalObject(input) -> Violation[]
```

### 2.1 Schema shape (sketch — illustrative, not final code)

```ts
// CanonicalObjectSchema — the contract for one objectType per ONT-001.
export interface CanonicalObjectSchema {
  objectType: string;                 // "Candidate" | "Job" | "Submission" | "Account"
  /** Required + optional property shape. Unknown props are allowed (passthrough)
   *  so today's extra fields never fail — only declared invariants are checked. */
  properties: z.ZodTypeAny;           // z.object({...}).passthrough()
  /** Legal status domain (ONT-001 §Lifecycle). */
  status: z.ZodEnum<[string, ...string[]]>;
  /** At-least-one-of and cross-field rules expressed as refinements. */
}

// e.g. Candidate: requires fullName OR email; status in {new,active,placed,archived}
```

`.passthrough()` is deliberate: the registry checks **declared invariants only**
(required fields, status domain). It never rejects an object for carrying extra
properties, so existing rich payloads (provenance, imports[], screeningAnswers,
education, …) remain valid untouched.

### 2.2 Registry

```ts
const REGISTRY = new Map<string, CanonicalObjectSchema>([
  ["Candidate", candidateSchema],
  ["Job", jobSchema],
  ["Submission", submissionSchema],
  ["Account", accountSchema],
]);

export function schemaFor(objectType: string): CanonicalObjectSchema | undefined {
  return REGISTRY.get(objectType);
}
```

Object types **without** a registered schema (RecruiterNote, Opportunity, etc.)
are simply not validated — exactly today's behavior — until a future ONT spec adds
them.

### 2.3 Warn-only integration point

A single, guarded call near the top of `upsertObject`, after inputs are known and
**before** any persistence, in **observe-only** mode:

```ts
// PROPOSED — warn-only; does not throw, does not alter the write.
const schema = schemaFor(input.objectType);
if (schema) {
  const violations = validateCanonicalObject(schema, input);   // pure, never throws
  if (violations.length > 0) {
    await emitOntologySchemaWarning(ctx, input, violations);    // audit/log signal
  }
}
// ... existing upsert logic unchanged ...
```

Properties of this integration:

- **No behavior change.** The function still creates/merges and returns the same
  object. Validation cannot turn a success into a failure (cf. the IOS Article IV
  observer principle: observation SHALL NOT change execution).
- **Fail-open.** `validateCanonicalObject` is pure and total; if it ever throws,
  the warn path is wrapped so the upsert is never blocked in Draft mode.
- **Warn channel = existing audit.** Emit `ontology.schema.warning` via
  `emitAudit` (and/or a structured log), carrying `{ objectType, externalKey,
  violations[] }`. This makes drift **queryable** using machinery that already
  exists, and gives a measurable baseline before any enforcement.

### 2.4 Enforcement mode (later, behind an ADR — NOT this pass)

A later pass introduces a per-tenant or global mode flag:

| Mode | Behavior | Gate |
|------|----------|------|
| `warn` (Draft default) | emit warning, write proceeds | ONT-001 Draft |
| `enforce` | reject violating writes with a typed `OntologySchemaError` | ONT-001 Active + ADR |

Switching to `enforce` SHALL NOT happen until (a) the warn-mode baseline shows a
zero (or explicitly-accepted) violation rate across importers/seeds, and (b) an
ADR promotes ONT-001 to Active. This is the reversibility guarantee.

## 3. Reusing the IOS-017 governance pattern

IOS-017 made the Canonical Object Contract *real* by adding a conformance test
(`tests/unit/architecture-spec-governance.test.ts`) that fails CI if a governed
spec omits the contract. We mirror that for the ontology so the schema registry
cannot silently drift from ONT-001:

Proposed `tests/unit/ontology-schema-registry.test.ts` (design only):

1. **Coverage** — every `objectType` declared canonical by ONT-001
   (`Candidate, Job, Submission, Account`) SHALL have a registered schema. (Mirrors
   "every IOS-017+ spec has a Canonical Object Contract".)
2. **Status domain parity** — each schema's status enum SHALL equal the lifecycle
   domain in ONT-001 §Lifecycle (Submission SHALL use `CandidateStage`).
3. **Required-field parity** — each schema's required fields SHALL match ONT-001
   §Public Interfaces.
4. **Warn-only proof** — a violating input SHALL produce ≥1 violation from
   `validateCanonicalObject` AND `upsertObject` SHALL still return the object
   (proving Draft mode never blocks). Run against the in-memory DB backend (the
   same backend the 434 unit tests already use — no Postgres needed).
5. **Passthrough proof** — an object with extra undeclared properties SHALL produce
   zero violations.

This makes the registry a governed artifact: ONT-001 is the spec, the registry is
the implementation, the test is the conformance proof — the same three-layer shape
IOS already uses.

## 4. Rollout phases (proposal)

| Phase | Deliverable | Behavior change | Gate |
|-------|-------------|-----------------|------|
| 1 (this pass) | ONT-001 spec + this design note | none | review |
| 2 | `schemas/` registry + pure `validateCanonicalObject` + conformance test | none (registry unused by runtime) | tests green |
| 3 | warn-only call in `upsertObject` + `ontology.schema.warning` audit | none (observe-only) | baseline measured |
| 4 | `enforce` mode + typed error + ADR promoting ONT-001 → Active | rejects violations | ADR + clean baseline |

## 5. Risks & mitigations

- **Risk: hidden behavior change in the upsert path.** *Mitigation:* observe-only,
  fail-open, wrapped; conformance test #4 proves writes still succeed.
- **Risk: false-positive drift noise.** *Mitigation:* `.passthrough()` checks only
  declared invariants; measure the warn baseline before enforcing.
- **Risk: schema/spec divergence.** *Mitigation:* the parity tests (#2, #3) fail CI
  if the registry and ONT-001 disagree.
- **Risk: performance on hot import paths.** *Mitigation:* Zod parse is per-object
  and cheap; validation is skippable for unregistered types and can be gated behind
  the mode flag.
- **Risk: tenant variance in lifecycle vocabulary.** *Mitigation:* keep the status
  enum global in v1.0; defer per-tenant extension to ONT-003.

## 6. Open questions (for review before Phase 2)

1. Warn channel: audit event only, structured log only, or both?
2. Should the warn baseline be surfaced on a Mission Control readiness check?
3. `Account` required-field tightening — keep `title`-only for v1.0, or also
   require `industry`/`owner` once a client spec exists?
4. Mode flag scope — global, per-tenant, or per-objectType?

## 7. Explicitly out of scope for this pass

- No changes to `object-service.ts` or any runtime file.
- No new dependency (`zod` is already a project dependency).
- No enforcement; no rejection of any write.
