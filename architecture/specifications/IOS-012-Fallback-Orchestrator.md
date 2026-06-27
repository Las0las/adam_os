# IOS-012 — Fallback Orchestrator

| Field | Value |
|-------|-------|
| Identifier | IOS-012 |
| Version | 1.1 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004 (v1.2), IOS-005, IOS-006, IOS-007, IOS-008, IOS-009, IOS-010, IOS-011, ADR-0003, ADR-0004, DD-001 |

## Purpose

The Fallback Orchestrator SHALL coordinate deterministic fallback across providers
and models after the primary execution path (retry, circuit breaker) has failed
with a transient/unavailable error, redirecting the invocation to an alternate
target that the routing layer has already authorized. Behavior SHALL be governed
entirely by immutable FallbackPolicy objects and SHALL be deterministic.

## Scope

Governs FallbackPolicy, the failure classifier, the deterministic ordered strategy,
the coordinator, fallback events, and fallback metrics. Out of scope (future
specifications): Provider Health Management (IOS-013), adaptive routing, cost
optimization, benchmark-informed fallback, learned provider ranking, multi-region
routing, dynamic policy generation, probabilistic or evaluation-guided selection.

## Architectural Placement

The orchestrator composes ENTIRELY through the AS-001 R9 / IOS-004 AroundInvoke
contract and its ADR-0004 Execution Plan capability — no new execution seam. It
attaches at priority 2.45, between the circuit breaker (2.4) and retry (2.5):

```
Execution Pipeline → Prompt Cache → Batch Scheduler → Security Middleware →
  Circuit Breaker → Fallback Orchestrator → Retry Policy → Provider Adapter →
  Execution Event Bus
```

Composing outside retry means each fallback target gets its own retry budget;
composing inside the circuit breaker means a recovered fallback is observed as a
success by the outer breaker (so the breaker does not trip when fallback recovers).

## Responsibilities

- Invoke the primary (routing-selected) path via `next(request)`.
- On a fallback-eligible failure, redirect to alternate targets SELECTED FROM the
  routing-authorized Execution Plan (`ctx.executionPlan`) in deterministic order
  via `next(request, target)`, stopping at the first success or exhausting the
  bounded chain. Targets are never invented or authorized here.
- Publish fallback events and collect passive fallback metrics.

## Fallback Policy

`FallbackPolicy` (immutable): mode (enabled/disabled), `fallbackProviders` (an
OPTIONAL ordered allow-list/restriction over Execution-Plan alternates — never a
target source: it can only narrow/order plan members), maxFallbackAttempts,
fallbackErrorClasses, eligibleProviders, eligibleWorkloads, bypass. Policies SHALL
remain immutable during execution; the default policy is DISABLED.

## Fallback Eligibility

Fallback MAY occur only when the primary failure's normalized kind is in
`fallbackErrorClasses` (default: timeout, rate_limit, provider_unavailable — which
also covers circuit-breaker rejections and provider unavailability), and only for a
target contained in the routing-authorized Execution Plan. Fallback SHALL NOT occur
for security middleware rejection, validation failure, authentication failure,
prompt-firewall rejection, or PII rejection (these arise outside the provider
invocation and never reach the orchestrator).

## Fallback Strategy

Deterministic ordered fallback ONLY. Targets are the Execution Plan's alternates
(every plan target except the primary) in plan (routing-preference) order,
optionally restricted/reordered by `fallbackProviders` (an allow-list over plan
members — it can never add a target absent from the plan), and bounded by
`maxFallbackAttempts`. No adaptive routing, cost optimization, probabilistic
selection, or evaluation-informed routing.

## Public Interfaces

- `FallbackPolicy`, `FallbackPolicyStore` (immutable); `fallbackEligible`,
  `orderedFallbackTargets`, `isFallbackEligible` (classifier).
- `FallbackOrchestrator` (implements `ExecutionHook.aroundInvoke`),
  `FallbackCoordinator`.
- Fallback events (`fallback.started`, `fallback.attempt`, `fallback.succeeded`,
  `fallback.exhausted`, `fallback.bypassed`); `isFallbackEvent`.
- `FallbackMetricsCollector` (attempts, success rate, exhaustion, provider
  transitions, latency).

## Invariants

- Fallback SHALL preserve request identity, execution context, auditability,
  middleware ordering, and deterministic execution.
- Fallback SHALL NOT re-run routing, mutate the RoutingDecision/plan, invent or
  authorize targets, or bypass security, validation, telemetry, or audit.
- Only targets contained in the routing-authorized Execution Plan are eligible; the
  pipeline independently rejects any target absent from the plan.
- The FallbackPolicy SHALL be immutable during execution; default disabled (no-op).

## Dependencies

- IOS-003 v1.1 (Execution Plan), IOS-004 v1.2 (`aroundInvoke` + Execution Plan),
  IOS-005 (event bus); conforms to IOS-006, IOS-007, IOS-008, IOS-009, IOS-010,
  IOS-011 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A transient/unavailable primary failure SHALL fall back to the next plan target
   and SHALL succeed if a target succeeds.
2. The fallback chain SHALL be exhausted (returning the normalized failure) when
   every target fails.
3. Targets SHALL be tried in deterministic plan order.
4. Fallback SHALL compose with retry so that each target gets its own retry budget.
5. Fallback SHALL compose with the circuit breaker so that a recovered fallback is
   seen as success by the outer breaker (no trip on recovery).
6. Security/validation SHALL run once around the whole invocation (not per attempt);
   a security rejection SHALL never reach fallback.
7. A non-eligible primary failure (e.g. authentication) SHALL NOT engage fallback.
8. A policy target not contained in the Execution Plan SHALL be skipped (never
   invoked); the policy SHALL NOT add a target absent from the plan.
9. Fallback events and metrics SHALL be produced.
10. A disabled policy (and `bypass`/ineligible execution) SHALL be a no-op; all
    existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0004 (Execution Plan / routing-authorized targets — enables IOS-012);
  ADR-0003 (AroundInvoke); ADR-0001, ADR-0002.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/fallback/*` (fallback-types, fallback-classifier,
  fallback-strategy, fallback-events, fallback-coordinator, fallback-orchestrator,
  fallback-metrics, fallback-bootstrap); reuses the `aroundInvoke` hook + Execution
  Plan in `src/lib/aiops/execution/inference-pipeline.ts`, `execution-types.ts`,
  and `src/lib/aiops/routing/execution-plan.ts`; wired in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/fallback-orchestrator.test.ts`,
  `tests/unit/architecture-execution-plan.test.ts`.
