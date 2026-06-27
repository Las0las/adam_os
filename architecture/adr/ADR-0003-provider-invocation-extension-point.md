# ADR-0003 — Provider-Invocation Extension Point for IOS-004

| Field | Value |
|-------|-------|
| Identifier | ADR-0003 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | IOS-004 Execution Pipeline (revised), IOS-010 (enabled) |
| Supersedes | — |
| Superseded By | — |

## Title

Add a minimal, additive provider-invocation middleware hook (`aroundInvoke`) to
the IOS-004 Execution Pipeline so resilience capabilities (starting with IOS-010
Retry Policy) can wrap the provider call through a published extension point.

## Status

Accepted. (Approved by the LAWRENCE Architecture Council to unblock IOS-010,
under the Architectural Evolution Policy — change to a Public Contract proceeds
through an ADR + Specification revision.)

## Context

IOS-010 Retry Policy SHALL retry transient provider failures from a position
**after the security middleware and around the provider call** (its placement is
`Security → Retry → Provider`). The frozen IOS-004 pipeline invokes the provider
exactly once (`completion = resolved ?? await invoke(effectiveRequest)`), and no
published extension point can wrap that invocation to retry it:

- `interceptRequest` runs **before** the provider (cannot re-invoke).
- `interceptResponse` runs only on **success** (a transient failure throws before
  it).
- `resolveCompletion` runs **before** the security middleware; using it to call
  the provider would **bypass the firewall/PII** — forbidden by IOS-006.
- `executionFailed` is **observation-only** and cannot change the outcome.

Therefore IOS-010 **cannot be implemented through the published IOS-004 extension
points**, which is the precise condition requiring an ADR.

## Decision

IOS-004 SHALL gain one **additive, optional** execution-hook method:

```ts
aroundInvoke?(
  request: CompletionRequest,
  ctx: InferenceExecutionContext,
  next: (request: CompletionRequest) => Promise<CompletionResponse>,
): Promise<CompletionResponse>;
```

- The pipeline SHALL compose all hooks implementing `aroundInvoke` as an onion
  around the single provider invocation, in priority order (lowest priority =
  outermost). When **no** hook implements it, the pipeline SHALL invoke the
  provider exactly as before.
- `aroundInvoke` SHALL wrap **only the provider call** (`invoke`). It SHALL NOT
  run when the response is resolved from cache (no provider call occurs). The
  request/response interceptors (security, validation) SHALL continue to run
  around it unchanged, so `aroundInvoke` cannot bypass security or validation.

## Alternatives Considered

- **Provider-layer retry wrapper.** Rejected: not an IOS-004 extension point
  (violates "integrate exclusively through IOS-004"), concentrates retry in the
  provider boundary, and would call `.complete()` outside the sanctioned files
  (architecture-test violation).
- **Re-call the whole pipeline on failure.** Rejected: re-runs cache/batch each
  attempt and does not match the in-chain placement.
- **No change (use existing hooks).** Rejected: demonstrably insufficient (see
  Context).

## Consequences

- IOS-010 (and future resilience layers — IOS-011 Circuit Breaker, IOS-012
  Fallback Orchestrator) can attach through one published, composable extension
  point.
- A new optional hook slightly enlarges the IOS-004 contract. This is the
  **minimal** additive change that satisfies the requirement.

## Compatibility Analysis

- **Byte-for-byte unchanged when unused.** With no `aroundInvoke` hook registered,
  the composed chain reduces to `(req) => invoke(req)` — identical to the prior
  single invocation. All existing tests pass unchanged.
- **All existing middleware unaffected.** Cache (`resolveCompletion`/
  `recordCompletion`), security (`interceptRequest`/`interceptResponse`),
  telemetry/audit/health/metrics (observation hooks), and batching are untouched;
  their phases run in the same order.
- **Backward compatible.** The hook is optional; existing `ExecutionHook`
  implementers need no change. Dependency direction is preserved; no routing,
  provider, or application change.

## Conformance Impact

IOS-004 SHALL be revised to document `aroundInvoke` in its Public Interfaces and
to add a conformance requirement: *the provider invocation SHALL be wrappable by
`aroundInvoke` hooks in priority order, and SHALL behave identically to a single
direct invocation when none are registered.*

## Approval

Approved by the LAWRENCE Architecture Council, 2026-06-27, to enable IOS-010 via a
minimal additive extension point, without bypassing constitutional governance.
