# ADR-0004 — Execution Plan: Routing-Authorized Targets for the AroundInvoke Contract

| Field | Value |
|-------|-------|
| Identifier | ADR-0004 |
| Status | Closed |
| Date | 2026-06-27 |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | IOS-003 Governed Routing (revised to v1.1), IOS-004 Execution Pipeline (revised to v1.2), IOS-012+ (consumers) |
| Supersedes | — |
| Superseded By | — |

## Title

Establish an immutable **Execution Plan** — the ordered set of execution targets
the routing layer selects and authorizes for an execution — and let an execution
middleware request, through the AroundInvoke contract, invocation of an alternate
**Execution Target that is already contained in that plan**. This is a permanent,
general execution capability — **not** a fallback-specific mechanism. Fallback
Orchestrator (IOS-012) is its first consumer.

## Status

**Closed.** Accepted and implemented: IOS-003 (v1.1) additively emits the Execution
Plan on the RoutingDecision; IOS-004 (v1.2) accepts an optional plan target on the
AroundInvoke `next`, resolved and enforced by the pipeline against the immutable
plan; architecture conformance tests pass; IOS-012 ships as the first consumer. The
Execution Plan is now the **canonical contract** between Governed Routing and the
Execution Pipeline. No additional execution-control abstraction SHALL be introduced;
future specifications (Provider Health Manager, Benchmark Harness, Evaluation
Engine, Adaptive Routing, Traffic Replay, Explainability, …) SHALL consume this
contract rather than extend it.

## Separation of Responsibilities (constitutional boundary)

- **Routing owns target selection AND authorization.** The Routing Engine
  evaluates the registry against the request and policy and produces the immutable
  Execution Plan — the ordered, authorized candidate targets. Nothing else selects
  or authorizes targets.
- **Execution owns invocation.** The Execution Pipeline invokes ONLY targets
  contained in the plan, and remains the sole caller of `.complete()`.
- **Middleware owns execution policy.** Execution middleware MAY select which plan
  target to invoke (and in what order); it SHALL NOT invent, authorize, or mutate
  invocation targets, and SHALL NOT re-run or mutate the RoutingDecision.

The execution layer SHALL NOT authorize or construct alternate invocation targets.
A middleware requests an alternate target *already present in the current plan*; it
SHALL NOT request arbitrary provider/model pairs.

## Context

The AroundInvoke contract (ADR-0003) lets a middleware re-invoke the provider via
`next`, but the pipeline binds `next` to the **routing-selected** target, so the
contract cannot express invocation retargeting (see ADR-0003). An initial design
had the *pipeline* authorize an arbitrary `(provider, model)` override against the
RoutingDecision. That blurred the constitutional boundary: it made the execution
layer the authorizer of targets, and let middleware name arbitrary pairs the
pipeline then vetted. The correct boundary is that **routing** authorizes the
candidate set, **execution** merely invokes members of it, and **middleware**
chooses among them. The routing engine already computes its full ordered survivor
list but the RoutingDecision discarded all but the top; that ordered, authorized
list *is* the Execution Plan.

This is the precise condition AS-001 R9 contemplates: an existing published
extension contract is insufficient for execution-control middleware that must
invoke an alternate authorized target (Fallback IOS-012, Provider Health IOS-013,
Benchmark Harness IOS-014, Evaluation Engine IOS-017, Adaptive Routing IOS-022).

## Decision

1. **Routing emits the Execution Plan (IOS-003, additive).** `RoutingDecision`
   gains an optional immutable `executionPlan: { targets: readonly ExecutionTarget[] }`,
   populated by the routing engine from its ordered authorized survivors
   (`targets[0]` = the selected/primary target; the rest are authorized alternates
   in routing-preference order). Existing consumers ignore the field; when absent
   (legacy decisions), the plan is the single selected target.

2. **AroundInvoke requests a plan target (IOS-004 v1.2, additive).** The `next`
   callback gains an optional `ExecutionTarget`:

   ```ts
   next: (request: CompletionRequest, target?: ExecutionTarget) => Promise<CompletionResponse>
   interface ExecutionTarget { provider: string; model: string }
   ```

   - **Default unchanged.** `next(request)` invokes the primary plan target —
     byte-for-byte identical to before.
   - **Plan members only.** `next(request, target)` invokes `target` only if it is
     **contained in `ctx.executionPlan`** (`planContains`). A target absent from
     the plan is rejected (normalized `provider_unavailable`); the provider is not
     invoked. The pipeline does not authorize — membership in the routing-produced
     plan *is* the authorization.
   - **No routing, no mutation.** The pipeline SHALL NOT re-run routing or mutate
     the RoutingDecision / plan.
   - **Propagation.** A target supplied by an outer middleware threads through inner
     middleware (which call `next` without a target); an inner middleware that
     supplies its own target takes precedence (`thisTarget ?? outerTarget`).
   - **No routing context, no alternates.** On the already-resolved-provider path
     (`runModelCompletion`), the plan is the single resolved target; any other
     override is rejected.

3. **The Execution Plan travels on the execution context.** `ctx.executionPlan`
   exposes the immutable plan to middleware so it can select a target without
   touching routing.

### Reuse by future specifications

The following SHALL reuse this capability with **no additional architectural
change**: **IOS-012 Fallback Orchestrator** (first consumer), **IOS-013 Provider
Health Manager**, **IOS-014 Benchmark Harness**, **IOS-017 Evaluation Engine**,
**IOS-022 Adaptive Routing**, **Traffic Replay**, **Explainability**, and any other
execution-governance specification. These SHALL **consume** the Execution Plan
contract rather than extend it. No additional execution-control abstraction SHALL
be introduced; the Execution Plan is the canonical contract between Governed
Routing and the Execution Pipeline.

## Invariants

- **The Execution Plan is an ordered, enumerable collection of `ExecutionTarget`s
  with deterministic ordering** (`targets[0]` = primary; alternates follow in the
  routing engine's total, stable preference order).
- **The Execution Plan is IMMUTABLE after creation** (deep-frozen with the
  RoutingDecision). Execution middleware MAY select or advance to another
  authorized target already present in the plan, but SHALL NOT modify, reorder,
  insert, remove, or authorize execution targets.
- The Execution Pipeline SHALL invoke ONLY targets contained in the plan, SHALL
  NOT re-run routing, and SHALL NOT mutate the RoutingDecision or plan.
- Routing is the SOLE authority that selects and authorizes invocation targets.

## Alternatives Considered

- **Pipeline authorizes an arbitrary (provider, model) override.** Rejected on
  refinement: it makes execution the authorizer and lets middleware name arbitrary
  pairs. The plan model keeps routing authoritative.
- **A fallback-specific mechanism.** Rejected: solves IOS-012 only; the plan is the
  general contract for the whole resilience/evaluation track.
- **Let middleware resolve and invoke alternates.** Rejected: violates the single
  `.complete()` site and makes middleware perform routing.
- **Re-enter the pipeline per alternate.** Rejected: new executionId, re-run
  security/cache/validation, broken auditability and "runs once".

## Compatibility Analysis (demonstrated)

- **Completely additive.** One optional field on `RoutingDecision`; one optional
  parameter on the `next` callback. No existing `aroundInvoke` implementer changes —
  Retry (IOS-010) and Circuit Breaker (IOS-011) are untouched and pass unchanged.
- **Byte-for-byte identical when no override is supplied** — proven by an
  architecture conformance test and the full pre-existing suite passing unchanged.
- **Routing stays authoritative.** Only plan members are invokable; non-plan
  targets are rejected — proven by conformance tests.
- **RoutingDecision / plan never mutated; routing never re-executed** — proven by a
  conformance test (the frozen decision and plan are byte-for-byte unchanged).
- **Deterministic, order-preserving.** Overrides thread through inner middleware and
  onion order is preserved — proven by conformance tests.

## Conformance Impact

- **IOS-003 v1.1**: document the additive `executionPlan` on the RoutingDecision
  (ordered authorized targets; primary first).
- **IOS-004 v1.2**: document the Execution Plan as a general execution capability of
  the AroundInvoke contract, with conformance requirements that (1) no override is
  byte-for-byte identical; (2) a plan member is invoked deterministically; (3) a
  non-plan target is rejected and not invoked; (4) routing is never re-executed and
  the decision/plan never mutated; (5) an outer override threads through inner
  middleware with order preserved.

## Approval

Approved by the LAWRENCE Architecture Council, 2026-06-27, establishing the
immutable Execution Plan and the routing/execution/middleware separation of
responsibilities for the Inference Operating System (first consumer: IOS-012).
