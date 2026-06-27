# ADR-0004 — Invocation Target Override for the AroundInvoke Contract

| Field | Value |
|-------|-------|
| Identifier | ADR-0004 |
| Status | Accepted |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | IOS-004 Execution Pipeline (revised to v1.2), IOS-012+ (consumers) |
| Supersedes | — |
| Superseded By | — |

## Title

Establish a **general invocation-target override** capability on the AroundInvoke
provider-invocation contract (AS-001 R9 / IOS-004). An execution middleware MAY
request invocation of an **alternate target** (provider + model) that the routing
layer has **already authorized** for the current execution. This is a permanent,
general execution capability — **not** a fallback-specific mechanism. Fallback
Orchestrator (IOS-012) is merely its first consumer.

## Status

**Accepted.** Implemented: IOS-004 revised to v1.2; the AroundInvoke `next`
signature gains an optional invocation target resolved by the pipeline against the
already-authorized routing context; architecture conformance tests pass; IOS-012
ships as the first consumer.

## Architectural Principle

- **Routing remains authoritative.** Only the routing layer (IOS-003) decides
  which (provider, model) targets are permissible for an execution.
- **Execution remains authoritative for invocation.** The pipeline (IOS-004) is
  the only component that invokes a provider (`.complete()`), and remains so.
- **The RoutingDecision is immutable.** Execution middleware SHALL NOT mutate or
  recreate a RoutingDecision, and SHALL NOT re-run routing.

The objective is **not** to let middleware perform routing. It is to let execution
middleware request invocation of an alternative target **that routing has already
authorized**, with the pipeline resolving and invoking that target.

## Context

The AroundInvoke contract (ADR-0003) lets a middleware re-invoke the provider via
`next`. But the pipeline binds `next` to the **routing-selected** target: the
`invoke` closure captures `provider`/`model` and resolves the adapter from the
per-call registry, so `next(request)` always re-hits the same target. The contract
therefore **cannot express invocation retargeting**:

- `next` accepts only a `request` — there is no parameter to name another target.
- `InferenceExecutionContext` is deep-frozen and a middleware singleton has no
  access to the per-call registry, so it cannot resolve an alternate adapter.
- Only `inference-pipeline.ts` / `model-provider.ts` may call `.complete()`
  (enforced by `architecture-execution.test.ts`), so a middleware cannot invoke an
  alternate provider directly.
- Re-entering via `executeInference` / `runModelCompletion` would mint a new
  executionId and re-run security/cache/validation, violating request identity,
  execution context, auditability, and "each middleware runs once".

Any execution-control middleware that must invoke an alternate authorized target —
Fallback Orchestrator (IOS-012), and later Provider Health Manager (IOS-013),
adaptive selection, evaluation-guided execution — is therefore blocked. Under
AS-001 R9 this is the precise condition requiring governance: an existing published
extension contract is **insufficient**.

## Decision

The AroundInvoke contract SHALL gain an **additive, optional** invocation-target
parameter on `next`:

```ts
aroundInvoke?(
  request: CompletionRequest,
  ctx: InferenceExecutionContext,
  next: (request: CompletionRequest, target?: InvocationTarget) => Promise<CompletionResponse>,
): Promise<CompletionResponse>;

interface InvocationTarget { provider: string; model: string }
```

- **Default unchanged.** Called with only a request, `next` invokes the
  routing-selected target — byte-for-byte identical to before.
- **Override resolved by the pipeline.** Called with a target, the **pipeline**
  resolves that (provider, model) from the same per-call registry and invokes it.
  `.complete()` stays solely in the pipeline.
- **Authorized targets only.** The pipeline SHALL invoke an override only if it is
  **authorized by the immutable RoutingDecision** — i.e. it is the selected target,
  or its provider was evaluated by routing and the (provider, model) pair was not
  rejected (`isAuthorizedTarget`). An unauthorized override is rejected
  (normalized `provider_unavailable`); the provider is not invoked.
- **No routing, no mutation.** The pipeline SHALL NOT re-run routing and SHALL NOT
  mutate the RoutingDecision. The override names a target; the decision is read-only.
- **Propagation.** A target supplied by an outer middleware threads through inner
  middleware (which call `next` without a target) to the provider; an inner
  middleware that supplies its own target takes precedence (`thisTarget ??
  outerTarget`). Composition order is unchanged.
- **No routing context, no override.** On the already-resolved-provider path
  (`runModelCompletion`, `routingDecision === null`) no override can be authorized;
  supplying one is rejected.

### Reuse by future specifications

The following SHALL reuse this capability with **no additional architectural
change**: **IOS-012 Fallback Orchestrator** (first consumer), **IOS-013 Provider
Health Manager**, adaptive provider selection, evaluation-guided execution, and any
other execution-governance middleware that must invoke an alternate authorized
target.

## Alternatives Considered

- **A fallback-specific hook / mechanism.** Rejected: solves IOS-012 only and would
  force another contract change for IOS-013 and beyond. A general retargeting
  capability is the minimal change that permanently unblocks the track.
- **Carry the target on `ctx` or the request.** Rejected: `ctx` is immutable and
  the request is provider-payload, not routing context; both would blur the
  routing/execution boundary.
- **Let middleware resolve and invoke alternates (registry access + `.complete()`).**
  Rejected: violates the single-invocation-site invariant (architecture test) and
  makes middleware perform routing.
- **Re-enter the pipeline per alternate.** Rejected: new executionId, re-run
  security/cache/validation, broken auditability and "runs once".
- **No change.** Rejected: demonstrably insufficient (see Context).

## Compatibility Analysis (demonstrated)

- **Completely additive.** One new OPTIONAL parameter on the `next` callback. No
  existing `aroundInvoke` implementer changes — `next(request)` keeps its meaning.
  Retry (IOS-010) and Circuit Breaker (IOS-011) are untouched and pass unchanged.
- **Byte-for-byte identical when no override is supplied.** With every middleware
  calling `next(request)`, `target` stays `undefined` and the routing-selected
  provider is invoked exactly once — proven by an architecture conformance test and
  the full pre-existing suite passing unchanged.
- **Routing stays authoritative.** Only targets authorized by the immutable
  RoutingDecision are invokable; unauthorized overrides are rejected — proven by
  conformance tests.
- **RoutingDecision never mutated; routing never re-executed** — proven by a
  conformance test (the frozen decision is byte-for-byte unchanged after an
  override execution).
- **Deterministic, order-preserving.** Overrides thread through inner middleware
  and onion order is preserved — proven by conformance tests.

## Conformance Impact

IOS-004 SHALL be revised to v1.2 to document the Invocation Target Override as a
general execution capability of the AroundInvoke contract, and to add conformance
requirements that:

1. with no override, execution is byte-for-byte identical to the prior pipeline;
2. a valid override invokes the alternate **authorized** target deterministically;
3. an unauthorized override is rejected and the provider is not invoked;
4. routing is never re-executed and the RoutingDecision is never mutated;
5. an outer override threads through inner middleware while composition order is
   preserved.

## Approval

Approved by the LAWRENCE Architecture Council, 2026-06-27, establishing a permanent,
general invocation-target override capability on the AroundInvoke contract for the
Inference Operating System (first consumer: IOS-012).
