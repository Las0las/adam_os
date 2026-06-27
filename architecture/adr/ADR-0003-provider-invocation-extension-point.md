# ADR-0003 — Provider-Invocation Middleware Extension Point for IOS-004

| Field | Value |
|-------|-------|
| Identifier | ADR-0003 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | IOS-004 Execution Pipeline (revised to v1.1), IOS-010+ (consumers) |
| Supersedes | — |
| Superseded By | — |

## Title

Establish a **general provider-invocation middleware extension point**
(`aroundInvoke`) for the IOS-004 Execution Pipeline. This is a permanent execution
extension contract for the Inference Operating System — **not** a retry-specific
mechanism. Retry Policy (IOS-010) is merely its first consumer.

## Status

Accepted. (Approved by the LAWRENCE Architecture Council under the Architectural
Evolution Policy — a change to a Public Contract proceeds through an ADR +
Specification revision.)

## Context

A class of execution-governance middleware must **control the provider
invocation itself** — wrapping it to re-attempt, short-circuit, time-box, or
divert it. The frozen IOS-004 pipeline invokes the provider exactly once
(`completion = resolved ?? await invoke(effectiveRequest)`), and **none of the
published extension points can wrap that invocation**:

- `interceptRequest` runs **before** the provider (cannot re-invoke or wrap it).
- `interceptResponse` runs only on **success** (a failed invocation never reaches it).
- `resolveCompletion` runs **before** the security middleware; using it to call the
  provider would **bypass the firewall/PII** — forbidden by IOS-006.
- `executionFailed` is **observation-only** and cannot change the outcome.

Therefore the current IOS-004 extension points are **insufficient for any
middleware that must control provider invocation** — not only retry, but circuit
breaking, fallback, health-gated invocation, and similar resilience/governance
capabilities. This is the precise condition requiring an ADR (DD-001 /
Architectural Evolution Policy).

## Decision

IOS-004 SHALL gain one **additive, optional**, general execution-middleware
extension point on `ExecutionHook`:

```ts
aroundInvoke?(
  request: CompletionRequest,
  ctx: InferenceExecutionContext,
  next: (request: CompletionRequest) => Promise<CompletionResponse>,
): Promise<CompletionResponse>;
```

- **General, not retry-specific.** `aroundInvoke` is a provider-invocation
  middleware seam. A middleware receives `next` (the downstream invocation chain,
  ultimately the provider) and MAY call it zero, one, or many times, returning the
  response. This generality covers retry, circuit breaking, fallback, health
  gating, and future execution-governance middleware.
- **Composition.** The pipeline SHALL compose all hooks implementing
  `aroundInvoke` as an onion around the single provider invocation, in the hooks'
  established order (priority, then registration order as a stable tie-break) —
  the first hook is **outermost**. Composition is deterministic and
  registration-order-preserving.
- **Scope.** `aroundInvoke` wraps **only the provider call**. It SHALL NOT run when
  the response is resolved from cache (no provider call occurs). The request and
  response interceptors (security, validation) continue to run around it, so an
  `aroundInvoke` middleware cannot bypass security or validation.

### Reuse by future specifications

The following SHALL reuse this single extension point with **no additional
architectural change**: **IOS-010 Retry Policy** (first consumer), **IOS-011
Circuit Breaker**, **IOS-012 Fallback Orchestrator**, **IOS-013 Provider Health
Manager**, and any other execution-governance middleware that must control
provider invocation. Each composes around `aroundInvoke` by registering with an
appropriate priority.

## Alternatives Considered

- **A retry-specific hook.** Rejected: it would solve IOS-010 only and force a new
  ADR/contract change for IOS-011/012/013. A general seam is the minimal change
  that permanently unblocks the resilience track.
- **Provider-layer wrapper.** Rejected: not an IOS-004 extension point, calls
  `.complete()` outside the sanctioned files (architecture-test violation),
  concentrates control at the provider boundary.
- **Re-call the whole pipeline on failure.** Rejected: re-runs cache/batch/security
  each attempt and does not match in-chain placement.
- **No change.** Rejected: demonstrably insufficient (see Context).

## Consequences

- A single, permanent, composable seam for all provider-invocation middleware. The
  resilience/governance track (IOS-010 … IOS-013 and beyond) attaches without
  further architectural change.
- The IOS-004 contract grows by exactly one optional method — the minimal change.

## Compatibility Analysis (demonstrated)

- **Completely additive.** One new OPTIONAL method on `ExecutionHook`. No existing
  signature changes; no existing implementer requires modification.
- **Byte-for-byte identical when no `aroundInvoke` middleware is registered.** The
  pipeline builds the chain by folding `aroundInvoke` hooks around `invoke`; with
  none registered the chain reduces to `(req) => invoke(req)` — the exact prior
  single invocation. Proven by an architecture conformance test (no-middleware
  execution equals the prior pipeline) and by the entire pre-existing suite
  passing unchanged.
- **A pass-through middleware (`next()` only) is identical** to no middleware —
  proven by an architecture conformance test.
- **Existing middleware requires no modification.** Cache
  (`resolveCompletion`/`recordCompletion`), Security
  (`interceptRequest`/`interceptResponse`), Telemetry, Audit, Health (observation
  hooks), and Batch are untouched; their phases run in the same order.
- **Deterministic, registration-order-preserving composition.** Multiple
  `aroundInvoke` middleware compose as a deterministic onion in priority +
  registration order — proven by an architecture conformance test.
- **Backward compatibility fully preserved.** Optional hook; dependency direction
  unchanged; no routing, provider, or application change.

## Conformance Impact

IOS-004 SHALL be revised to v1.1 to document `aroundInvoke` as a general
provider-invocation middleware extension point in its Public Interfaces, and to
add conformance requirements that:

1. with no `aroundInvoke` middleware, execution is identical to the prior single
   invocation;
2. a pass-through `aroundInvoke` middleware (`next()` only) yields identical
   execution;
3. multiple `aroundInvoke` middleware compose deterministically in priority +
   registration order;
4. `aroundInvoke` does not run on a cache hit, and the request/response
   interceptors still run around it.

## Approval

Approved by the LAWRENCE Architecture Council, 2026-06-27, establishing a permanent
provider-invocation middleware extension contract for the Inference Operating
System (first consumer: IOS-010).
