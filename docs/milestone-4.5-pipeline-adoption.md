# Milestone 4.5 — Execution Pipeline Adoption

Pure architectural migration: the inference execution pipeline (Milestone 4.0)
is now the **only** supported provider-invocation path. No new functionality, no
behavior change.

## How the migration preserves behavior

Provider **resolution** is unchanged — call sites still resolve a provider via
`getModelProvider()` (process default) or `resolveModelProvider(ctx, purpose)`
(per-tenant routing). Only the **invocation** moved: every `provider.complete(…)`
call was replaced with `runModelCompletion({ provider, request, workloadType })`,
which runs the standard lifecycle (BeforeExecute → provider → AfterExecute /
ExecutionFailed hooks, normalized errors) and returns the same `CompletionResponse`.

Because the return value and the resolved provider are identical, downstream code
(trace recording, citations, text/JSON handling) is untouched, and all existing
tests pass unchanged. Execution hooks now observe 100% of inference traffic.

## 1. Provider Call Inventory (before migration)

13 direct provider invocations existed. All are now migrated.

| # | File | Function | Resolution | Status |
|---|------|----------|-----------|--------|
| 1 | `aiops/functions/builtins/answer-with-citations.ts` | `answer_with_citations` | `getModelProvider()` | migrated |
| 2 | `aiops/functions/builtins/classify-document.ts` | `classify_document` | `getModelProvider()` | migrated |
| 3 | `aiops/functions/builtins/generate-draft-response.ts` | `generate_draft_response` | `getModelProvider()` | migrated |
| 4 | `aiops/functions/builtins/extract-structured-fields.ts` | `extract_structured_fields` | `getModelProvider()` | migrated |
| 5 | `aiops/functions/builtins/recommend-next-action.ts` | `recommend_next_action` | `getModelProvider()` | migrated |
| 6 | `aiops/functions/builtins/summarize-object.ts` | `summarize_object` | `getModelProvider()` | migrated |
| 7 | `aiops/functions/builtins/extract-candidate-fields.ts` | `extract_candidate_fields` | `resolveModelProvider(extraction)` | migrated |
| 8 | `aiops/functions/builtins/extract-job-fields.ts` | `extract_job_fields` | `resolveModelProvider(extraction)` | migrated |
| 9 | `domains/recruiting/recruiting-functions.ts` | `recruiting.candidate_fit_summary` | `getModelProvider()` | migrated |
| 10 | `domains/claims/claims-functions.ts` | `claims.validation_summary` | `getModelProvider()` | migrated |
| 11 | `domains/support/support-functions.ts` | `support.answer_ticket` | `getModelProvider()` | migrated |
| 12 | `domains/onboarding/onboarding-functions.ts` | `onboarding.readiness_summary` | `getModelProvider()` | migrated |
| 13 | `domains/recruiting/recruiting-chat-service.ts` | chat intent classifier | `resolveModelProvider(chat)` | migrated |

## 2. Pipeline Migration

Every site above now flows: **Application → (resolution) → Execution Pipeline
(`runModelCompletion`) → Provider**. `executeInference` (registry + RoutingDecision)
remains the path for routing-driven execution; both share one lifecycle.

## 3 & 4. Enforcement (architecture tests)

`tests/unit/architecture-execution.test.ts` fails CI if a bypass is reintroduced:

- **No `.complete()` outside the pipeline** — only `inference-pipeline.ts` and the
  provider layer's own `model-provider.ts` (the metered wrapper) may call it.
- **Adapter classes imported only by their registrations** — no router or
  application imports a `*-client` adapter directly.
- **Router resolves through the registry**, never adapter classes.

## 5. Remaining exceptions (approved)

| Location | Why it is allowed |
|----------|-------------------|
| `aiops/execution/inference-pipeline.ts` | The sanctioned execution path itself. |
| `aiops/models/model-provider.ts` (`metered()` wrapper) | The provider interface boundary: it wraps the *active* provider to meter cost. It is the provider layer, not an application bypass; the pipeline's `.complete()` flows through it. |

No application-level direct provider invocation remains.

## Success criteria

- Every inference executes through the execution pipeline.
- Exactly one supported provider invocation path.
- Execution hooks see 100% of inference traffic.
- Enforcement tests prevent future bypasses.
