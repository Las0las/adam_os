# IOS-004 — Execution Pipeline

| Field | Value |
|-------|-------|
| Identifier | IOS-004 |
| Version | 1.1 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-005, IOS-006, IOS-007, ADR-0001 |

## Purpose

The Execution Pipeline SHALL be the single, deterministic path through which every
inference is invoked. It standardizes the lifecycle, normalizes all failures, and
provides the ordered extension points to which observability, security, and
caching attach (Constitution, Articles IV and V).

## Scope

Governs the execution lifecycle, the immutable execution context and result, the
normalized error taxonomy, the ordered hook/middleware registry, and the two
entry points (`executeInference`, `runModelCompletion`). Covers Milestones 4.0
(pipeline) and 4.5 (adoption as the only path). Excludes the behavior of specific
middleware (IOS-005/006/007).

## Responsibilities

- Build an immutable `InferenceExecutionContext` (ids, routing decision, provider,
  model, tenant, workload, start time, request fingerprint).
- Run the lifecycle: BeforeExecute → (resolveCompletion) → interceptRequest →
  provider → interceptResponse → (recordCompletion) → AfterExecute, with the
  ExecutionFailed path on any throw.
- Invoke the provider exactly once per execution and nowhere else in the system.
- Normalize every transport/provider failure to a stable `ExecutionError` kind;
  no raw exception SHALL escape.
- Expose a priority-ordered hook registry (lower priority first; registration
  order as a stable tie-break).
- Expose a **general provider-invocation middleware extension point**
  (`aroundInvoke`, added in v1.1 by ADR-0003). It is a permanent execution seam —
  not retry-specific — that any middleware needing to control the provider
  invocation reuses (IOS-010 Retry, IOS-011 Circuit Breaker, IOS-012 Fallback,
  IOS-013 Provider Health, …). Hooks implementing it compose as a deterministic
  onion around the single provider call (priority order, lowest = outermost;
  registration order as a stable tie-break). A middleware MAY call `next` zero,
  one, or many times. It wraps ONLY the provider call (not cache hits) and the
  request/response interceptors still run around it.

## Public Interfaces

- `executeInference(params, hooks?)`, `runModelCompletion(opts, hooks?)`.
- `InferenceExecutionContext`, `InferenceExecutionResult`, `ExecutionHook`.
- `ExecutionError` taxonomy + `normalizeError`, `isRetryable`.
- Hook registry: `registerExecutionHook`, `listExecutionHooks`,
  `clearExecutionHooks`.
- `ExecutionHook.aroundInvoke?(request, ctx, next)` — provider-invocation
  middleware (v1.1, ADR-0003).

## Invariants

- All inference SHALL flow through this pipeline; `.complete()` SHALL be called
  only here and within the provider layer (enforced by architecture tests).
- The execution context and result SHALL be immutable.
- The pipeline SHALL NOT reject (its result is always a normalized result);
  `runModelCompletion` returns the provider response unchanged or throws a
  normalized error.
- Hooks SHALL run in deterministic priority order.

## Dependencies

- IOS-001 (registry), IOS-003 (routing decision) · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A successful execution SHALL return a normalized result with provider, model,
   usage, and `finishReason`.
2. A provider failure SHALL be normalized to the correct `ExecutionError` kind
   and SHALL invoke ExecutionFailed hooks; AfterExecute SHALL NOT run.
3. The provider SHALL be invoked exactly once on the success path and zero times
   when a pre-provider interceptor rejects.
4. No source outside the pipeline and provider layer SHALL call `.complete(`.
5. (v1.1) With **no** `aroundInvoke` middleware registered, execution SHALL be
   byte-for-byte identical to a single direct provider invocation.
6. (v1.1) A **pass-through** `aroundInvoke` middleware (one that only calls
   `next`) SHALL produce identical execution to having none.
7. (v1.1) Multiple `aroundInvoke` middleware SHALL compose deterministically as an
   onion in priority order, with **registration order** as the stable tie-break
   (first = outermost).
8. (v1.1) `aroundInvoke` SHALL NOT run on a cache hit, and the request/response
   interceptors (security, validation) SHALL still run around it.

## Related ADRs

- ADR-0001 (governance framework); ADR-0003 (v1.1 `aroundInvoke` extension point).

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/execution/inference-pipeline.ts`, `execution-types.ts`,
  `execution-errors.ts`, `execution-hooks.ts`;
  `tests/unit/architecture-execution.test.ts` (single-path enforcement).
