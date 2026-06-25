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
- Source registry + raw-asset ingestion with kind detection and checksums
- Parser registry (JSON, CSV w/ RFC-4180 quoting, text/PDF/EML fallback) — pluggable via `supports()`
- Transform registry with 7 deterministic transforms (trim, lowercase, cast, map_values, select/reorder columns, case_when)
- Canonical pipeline runner executing the full §18 flow: parse → canonical doc/records → transforms → chunk/embed → ontology projection → lineage/audit
- Ontology object graph: idempotent upsert/merge on `(objectType, externalKey)`, links, history via audit
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
- Next.js 14 App Router shell: Command Center + DataOps / AIOps / Mission Control dashboards + sub-pages + all five domain surfaces, server-rendered from the live store
- API route handlers from the §45 surface: evidence search, function run, **agent run**, **evals run**, action execute, observability, runtime health

## Architecture

```
src/lib/
  lawrence-core/   db (tenant-scoped collections), audit, permissions, bootstrap, utils
  dataops/         sources, parsers, transforms, ontology, evidence, lineage, pipelines
  aiops/           models, retrieval, prompts, functions(+builtins), agents, evals, observability
  mission-control/ actions, review-queue, notifications, runtime(deployments/health/rollback)
  domains/         recruiting (seed pack)
src/types/         platform.ts, dataops.ts, aiops.ts, mission-control.ts, domain.ts
app/               (marketing) + (lawrence) route groups, api/ route handlers
supabase/migrations/0001_lawrence_core.sql   the §46 Postgres schema
tests/unit/        dataops, aiops, mission-control suites (16 tests)
```

The in-memory `Collection` (`src/lib/lawrence-core/db/collection.ts`) is the seam where a real
Postgres/Supabase repository slots in — `0001_lawrence_core.sql` is the matching schema. Likewise
`MockModelProvider` is the seam for a real Claude/OpenAI provider.

## Run it

```bash
npm install
npm run seed        # end-to-end: ingest CSV → ontology → evidence → retrieval → function w/ citations
npm test            # 16 unit tests across the three fabrics
npm run typecheck   # strict tsc, noUncheckedIndexedAccess
npm run dev         # Next.js app at http://localhost:3000  (Command Center)
```

`npm run seed` prints a summary proving the full path works (candidates projected, evidence
chunked, retrieval ranked, a function run completed **with citations**, audit events emitted).

## Notable deviations from the spec

- **Routing:** the spec lists both `(marketing)/page.tsx` and `(lawrence)/page.tsx` mapping to `/`,
  which collide in Next.js. The Command Center owns `/`; the marketing page lives at `/welcome`.
- **Persistence:** Phase 1 uses an in-memory store (singleton) so the platform is runnable with no
  external services. The SQL migration is the production target; swap `Collection` for a repository.
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
