# LAWRENCE — Enterprise Operating System

> A governed enterprise operating system for commercial operations, recruiting, support,
> onboarding, and validation workflows — built on a canonical data pipeline, an operational
> ontology, evidence-backed AI reasoning, and mission-control-grade execution.

LAWRENCE is the implementation of the Palantir operating model translated into three fabrics:

| Palantir | LAWRENCE | Owns |
| --- | --- | --- |
| Foundry | **DataOps** | ingestion, canonical parsing, transforms, ontology projection, evidence fabric |
| AIP | **AIOps** | function runtime, agent runtime, retrieval, prompts/models, evals, observability |
| Apollo | **Mission Control** | deployments/releases, action execution, approvals, notifications, audit, rollback |

This repository is the **Phase 1 foundation** (per the spec's build sequence): a type-checked,
tested, end-to-end-runnable platform skeleton across all three fabrics, plus the Recruiting seed
pack. The architecture, module tree, and route tree match the spec so later packs (B–E) drop in.

## What's implemented and working

Everything below runs today against an in-memory, tenant-scoped store and is covered by tests
(`npm test`) and an end-to-end seed (`npm run seed`).

**DataOps**
- Asset ingestion: sha256 checksum **dedup** (with `force` override), ingestion batches, filesystem storage, kind detection, audit
- Parser registry with **real parsers** — JSON, CSV, XML (fast-xml-parser), XLSX (SheetJS, `sheet:/row:` source paths), PDF (graceful `extractionStatus=unavailable`, never faked text), DOCX (mammoth), EML (mailparser, attachments → child assets), image (OCR-unsupported placeholder)
- Transform registry with 7 deterministic transforms (trim, lowercase, cast, map_values, select/reorder columns, case_when)
- Canonical pipeline runner executing the full §18 flow plus **recursive EML attachment processing** (depth-limited, raw_asset→raw_asset lineage); pipeline preview (parse + transform, no persist)
- Ontology object graph: idempotent upsert/merge on `(objectType, externalKey)`, links, history via audit
- **Canonical ontology governance** — objects (ONT-001 / ADR-0006), relationships (ONT-002 / AS-005 / ADR-0008), and the **Enterprise Graph Integrity Engine** (ADR-0009): deterministic, rule-driven validation, warn-by-default with opt-in fail-closed enforce mode (`ONTOLOGY_SCHEMA_ENFORCEMENT`, `ONTOLOGY_RELATIONSHIP_ENFORCEMENT`, `ONTOLOGY_GRAPH_ENFORCEMENT`)
- **Graph Integrity review surface** (VS-006) — read-only, user-triggered governance page (`/mission-control/graph-integrity`) that runs `validateGraph()` on demand and shows Pass/Warning/Failed state, summary metrics, and findings grouped by severity/code/object/relationship/rule. No auto-fix; never changes write behavior.
- Evidence fabric: paragraph chunking + deterministic hashed embeddings

**AIOps**
- Model provider abstraction (deterministic `MockModelProvider` ships by default; real providers implement the same interface)
- Retrieval service implementing all five methods: `keyword`, `vector`, `augmented_keyword`, `hyde`, `rank_fusion` (reciprocal-rank fusion) — every hit carries method + score + source + excerpt
- Function runtime + 6 built-ins: `answer_with_citations`, `summarize_object`, `classify_document`, `extract_structured_fields`, `generate_draft_response`, `recommend_next_action`
- Agent runtime: a state machine over the §28 graph primitives (input/retrieve/function/condition/action/review/notify/output) with per-step traces
- Prompt template registry; evals harness with all three tracks (retrieval reciprocal-rank, extraction field-match, response keyword-coverage); observability traces (cost/latency/tokens/method)

**Mission Control**
- Action engine: idempotency → permission → precondition → approval routing → run → audit; customer-affecting actions gate on a review case unless explicitly exempted
- Review queue with case events and approve/reject/resolve transitions that release gated actions
- Notification engine: rule matching, `{{var}}` templating, dedupe, and an **allowlist for external destinations**
- Deployments: draft → staging → production promotion with approval gates, rollback, runtime health, incidents

**Platform & governance**
- Every collection is tenant-scoped by construction (the §47 "every row tenant-scoped" rule is structural, not a convention)
- Permission guards (`requirePermission`) on every privileged operation; permission classes per §47.2
- Audit emission on every state change

**Domain seed packs (§49–§53) — all five shipped**
- **Recruiting** — Candidate projection, approval-gated `advance_candidate_stage`, shortlist-builder agent
- **Onboarding** — OnboardingCase mapper, `onboarding_readiness_summary` / `detect_missing_docs`, blocker-escalation agent
- **Support** — SupportTicket/KnowledgeDocument, `classify_ticket_severity` / `draft_support_response`, triage agent with KB retrieval
- **Claims / Validation** — ClaimDocument, `extract_claim_fields` / `detect_contradictions` / `summarize_evidence`, `recommend_manual_review`, validation agent
- **Executive / Commercial Ops** — Account/Opportunity, `summarize_account_risk` / `generate_executive_brief`, approval-gated `escalate_margin_exception`, account-risk-monitor agent
- Each pack self-registers (functions/actions/mappers) and seeds live ontology objects + evidence

**UI & API**
- Next.js 14 App Router shell with **config-driven navigation** (`src/config/navigation`): Command Center + DataOps / AIOps / Mission Control dashboards, the **complete route tree** of sub-pages, and all six domain surfaces — server-rendered from the live store
- API route handlers from the §45 surface: evidence search, function run, **agent run**, **evals run**, action execute, observability, runtime health

**Persistence (Phase 2 schema pack)**
- The production Postgres schema ships as a split migration set (`db/migrations/0001_core.sql … 0009_claims.sql`, plus `0010_seed_views.sql` and `db/seeds/`).
- A Postgres adapter seam (`src/lib/lawrence-core/db/pg/`) + an example repository (`recruiting-repository.ts`) demonstrate the production read path; it activates when `DATABASE_URL` is set. With no `DATABASE_URL`, the in-memory `Collection` store backs the runtime so everything is runnable/testable locally.

## Architecture

```
src/lib/
  lawrence-core/   db (in-memory collections + pg adapter seam), audit, permissions, bootstrap, utils
  dataops/         sources, parsers, transforms, ontology, evidence, lineage, pipelines
  aiops/           models, retrieval, prompts, functions(+builtins), agents, evals, observability
  mission-control/ actions, review-queue, notifications, runtime(deployments/health/rollback)
  domains/         recruiting, onboarding, support, claims, commercial (seed packs)
src/config/        navigation, permissions, models
src/types/         platform.ts, dataops.ts, aiops.ts, mission-control.ts, domain.ts
app/               (marketing) + (lawrence) route groups (full route tree), api/ route handlers
db/migrations/     0001_core … 0009_claims + 0010_seed_views   (production Postgres schema pack)
db/seeds/          permissions, models, notification templates
tests/unit/        dataops, aiops, mission-control, domains suites (21 tests)
```

The in-memory `Collection` (`src/lib/lawrence-core/db/collection.ts`) is the seam where the real
Postgres repository (`src/lib/lawrence-core/db/pg/`, schema in `db/migrations/`) slots in. Likewise
`MockModelProvider` is the seam for a real Claude/OpenAI provider.

## Run it

### In-memory (default — no external services)

```bash
npm install
npm run seed        # end-to-end: ingest CSV → ontology → evidence → retrieval → function w/ citations
npm test            # 21 unit tests across the three fabrics + domains
npm run typecheck   # strict tsc, noUncheckedIndexedAccess
npm run dev         # Next.js app at http://localhost:3000  (Command Center)
```

### Postgres (set `DATABASE_URL` — the same code, real database)

```bash
export DATABASE_URL=postgres://user@host:5432/lawrence
npm run migrate     # applies db/migrations/0001…0010 (idempotent, tracked in schema_migrations)
npm run seed        # same seed, now persisted to Postgres (rt_* document tables)
npm run test:pg     # unit + integration suite against Postgres (serial; proves the pg backend)
npm run dev
```

The backend is chosen at startup by the presence of `DATABASE_URL`
(`src/lib/lawrence-core/db/index.ts`): `PgCollection` (Postgres) or `MemoryCollection`
(in-memory). Both implement the same async `Collection` interface, so every service behaves
identically — verified by running the identical test suite against both. `npm run seed` prints a
summary proving the full path works (candidates projected, evidence chunked, retrieval ranked, a
function run completed **with citations**, audit events emitted) in either mode.

## Notable deviations from the spec

- **Routing:** the spec lists both `(marketing)/page.tsx` and `(lawrence)/page.tsx` mapping to `/`,
  which collide in Next.js. The Command Center owns `/`; the marketing page lives at `/welcome`.
- **Persistence:** the runtime persists to Postgres via jsonb document tables (`rt_*`, see
  `db/runtime/README.md`) rather than the normalized `db/migrations/0001–0010` reference schema,
  because functions/agents/actions are code registries (not rows) by design. Both schemas coexist;
  the runtime can migrate onto the normalized tables table-by-table behind the same `Collection`
  interface. The in-memory store remains the default for local dev and tests.
- **Models/embeddings:** deterministic stand-ins ship so nothing requires API keys. Real providers
  implement `ModelProvider` / the embedding interface behind the same seams.

## Next packs (per spec §58)

- **Pack B** — richer function/retrieval (HyDE via real model, write-back policies)
- **Pack C** — agent Studio persistence, escalation policies
- **Pack D** — Studio UIs (React Flow pipeline/agent canvas)
- **Pack E** — onboarding / support / claims / executive domain packs (types already defined in `src/types/domain.ts`)

## Hard rules honored (§56)

1. No one-off AI features — everything lands in one of the fabrics.
2. Pipeline outputs map to ontology objects / evidence chunks, not loose datasets.
3. No untyped write-backs — functions carry output schemas; actions carry permissions/approval.
4. Retrieval is not opaque — method, score, source object, and excerpt are stored on every hit.
5. Customer-affecting actions require review or an explicit policy exemption.
6. Evals are first-class — retrieval quality is measured and scored.
