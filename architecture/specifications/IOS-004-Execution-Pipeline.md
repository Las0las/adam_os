# IOS-004 — Execution Pipeline

| Field | Value |
|-------|-------|
| Identifier | IOS-004 |
| Version | 1.2 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-005, IOS-006, IOS-007, ADR-0001, ADR-0003, ADR-0004 |

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
- Carry and honor the immutable **Execution Plan** (added in v1.2 by ADR-0004) —
  a general execution capability of the AroundInvoke contract. The plan is the
  ordered set of execution targets the **routing layer** selected and authorized
  (IOS-003 v1.1, `RoutingDecision.executionPlan`; `targets[0]` = primary); the
  pipeline exposes it on `ctx.executionPlan`. By default the pipeline invokes the
  primary target. An `aroundInvoke` middleware MAY pass `next` an optional
  `ExecutionTarget` to invoke an **alternate target that is contained in the plan**;
  the pipeline resolves and invokes it. A target NOT in the plan SHALL be rejected
  (`provider_unavailable`) and the provider SHALL NOT be invoked. The pipeline
  SHALL NOT authorize or construct targets, re-run routing, or mutate the
  RoutingDecision/plan — membership in the routing-produced plan IS the
  authorization. A target supplied by an outer middleware threads through inner
  middleware unless an inner middleware supplies its own. This is a general
  capability — not fallback-specific — reused by IOS-012 Fallback (first consumer),
  IOS-013 Provider Health, IOS-014 Benchmark Harness, IOS-017 Evaluation Engine,
  IOS-022 Adaptive Routing, and beyond.

## Public Interfaces

- `executeInference(params, hooks?)`, `runModelCompletion(opts, hooks?)`.
- `InferenceExecutionContext`, `InferenceExecutionResult`, `ExecutionHook`.
- `ExecutionError` taxonomy + `normalizeError`, `isRetryable`.
- Hook registry: `registerExecutionHook`, `listExecutionHooks`,
  `clearExecutionHooks`.
- `ExecutionHook.aroundInvoke?(request, ctx, next)` — provider-invocation
  middleware (v1.1, ADR-0003). `next(request, target?)` accepts an optional
  `ExecutionTarget` from the plan (v1.2, ADR-0004).
- `ExecutionTarget { provider, model }`, `ExecutionPlan { targets }`,
  `InferenceExecutionContext.executionPlan`; `buildExecutionPlan(decision)`,
  `planContains(plan, target)`
  (v1.2, ADR-0004).

## Invariants

- All inference SHALL flow through this pipeline; `.complete()` SHALL be called
  only here and within the provider layer (enforced by architecture tests).
- The execution context and result SHALL be immutable.
- The pipeline SHALL NOT reject (its result is always a normalized result);
  `runModelCompletion` returns the provider response unchanged or throws a
  normalized error.
- Hooks SHALL run in deterministic priority order.
- (v1.2) The **Execution Plan** is an ordered, enumerable collection of
  `ExecutionTarget`s with deterministic ordering, and is IMMUTABLE after creation.
  Execution middleware MAY select or advance to another authorized target already
  present in the plan, but SHALL NOT modify, reorder, insert, remove, or authorize
  execution targets. The pipeline SHALL invoke ONLY targets contained in the plan.

## Dependencies

- IOS-001 (registry), IOS-003 v1.1 (routing decision + Execution Plan) · AS-001 ·
  Constitution v1.0.

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
9. (v1.2) With **no** execution-target override supplied, execution SHALL be
   byte-for-byte identical to the prior pipeline.
10. (v1.2) A valid override (a target **contained in the Execution Plan**) SHALL be
    invoked deterministically (`.complete()` still only in the pipeline).
11. (v1.2) A target NOT contained in the Execution Plan SHALL be rejected
    (`provider_unavailable`) and the provider SHALL NOT be invoked.
12. (v1.2) Routing SHALL NOT be re-executed and the RoutingDecision / Execution
    Plan SHALL NOT be mutated by an override.
13. (v1.2) An override supplied by an outer middleware SHALL thread through inner
    middleware while composition order is preserved.

## Related ADRs

- ADR-0001 (governance framework); ADR-0003 (v1.1 `aroundInvoke` extension point);
  ADR-0004 (v1.2 Execution Plan / routing-authorized targets).

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/execution/inference-pipeline.ts`, `execution-types.ts`,
  `execution-errors.ts`, `execution-hooks.ts`;
  `src/lib/aiops/routing/execution-plan.ts` + `routing-types.ts` (Execution Plan,
  v1.2);
  `tests/unit/architecture-execution.test.ts` (single-path enforcement),
  `tests/unit/architecture-around-invoke.test.ts` (v1.1 conformance),
  `tests/unit/architecture-execution-plan.test.ts` (v1.2 conformance).
