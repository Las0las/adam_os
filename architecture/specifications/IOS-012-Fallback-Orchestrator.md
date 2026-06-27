# IOS-012 — Fallback Orchestrator

| Field | Value |
|-------|-------|
| Identifier | IOS-012 |
| Version | 1.0 |
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
contract and its ADR-0004 invocation-target override — no new execution seam. It
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
- On a fallback-eligible failure, redirect to alternate AUTHORIZED targets in
  deterministic policy order via the ADR-0004 override `next(request, target)`,
  stopping at the first success or exhausting the bounded chain.
- Publish fallback events and collect passive fallback metrics.

## Fallback Policy

`FallbackPolicy` (immutable): mode (enabled/disabled), ordered fallbackProviders,
ordered fallbackModels, maxFallbackAttempts, fallbackErrorClasses, eligibleProviders,
eligibleWorkloads, bypass. Policies SHALL remain immutable during execution; the
default policy is DISABLED.

## Fallback Eligibility

Fallback MAY occur only when the primary failure's normalized kind is in
`fallbackErrorClasses` (default: timeout, rate_limit, provider_unavailable — which
also covers circuit-breaker rejections and provider unavailability), and the target
is authorized by the routing layer. Fallback SHALL NOT occur for security
middleware rejection, validation failure, authentication failure, prompt-firewall
rejection, or PII rejection (these arise outside the provider invocation and never
reach the orchestrator).

## Fallback Strategy

Deterministic ordered fallback ONLY. With fallback providers configured, each is
paired by index with the fallback model at the same position (or the primary model
when absent); with only fallback models configured, each is tried on the primary
provider. The primary target is excluded and the sequence is bounded by
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
- Fallback SHALL NOT re-run routing, mutate the RoutingDecision, select an
  un-authorized target, or bypass security, validation, telemetry, or audit.
- Only targets authorized by the immutable RoutingDecision are eligible; the
  pipeline rejects any unauthorized override.
- The FallbackPolicy SHALL be immutable during execution; default disabled (no-op).

## Dependencies

- IOS-004 v1.2 (`aroundInvoke` + invocation-target override), IOS-005 (event bus);
  conforms to IOS-003, IOS-006, IOS-007, IOS-008, IOS-009, IOS-010, IOS-011 ·
  AS-001 · Constitution v1.0.

## Conformance Requirements

1. A transient/unavailable primary failure SHALL fall back to the next authorized
   target and SHALL succeed if a target succeeds.
2. The fallback chain SHALL be exhausted (returning the normalized failure) when
   every target fails.
3. Targets SHALL be tried in deterministic policy order.
4. Fallback SHALL compose with retry so that each target gets its own retry budget.
5. Fallback SHALL compose with the circuit breaker so that a recovered fallback is
   seen as success by the outer breaker (no trip on recovery).
6. Security/validation SHALL run once around the whole invocation (not per attempt);
   a security rejection SHALL never reach fallback.
7. A non-eligible primary failure (e.g. authentication) SHALL NOT engage fallback.
8. A target not authorized by routing SHALL be skipped (never invoked).
9. Fallback events and metrics SHALL be produced.
10. A disabled policy (and `bypass`/ineligible execution) SHALL be a no-op; all
    existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0004 (invocation-target override — enables IOS-012); ADR-0003 (AroundInvoke);
  ADR-0001, ADR-0002.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/fallback/*` (fallback-types, fallback-classifier,
  fallback-strategy, fallback-events, fallback-coordinator, fallback-orchestrator,
  fallback-metrics, fallback-bootstrap); reuses the `aroundInvoke` hook +
  invocation-target override in `src/lib/aiops/execution/inference-pipeline.ts`,
  `execution-types.ts`, `invocation-target.ts`; wired in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/fallback-orchestrator.test.ts`,
  `tests/unit/architecture-invocation-target.test.ts`.
