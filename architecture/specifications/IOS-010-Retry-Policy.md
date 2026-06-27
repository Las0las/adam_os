# IOS-010 — Retry Policy

| Field | Value |
|-------|-------|
| Identifier | IOS-010 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-004 (v1.1), IOS-005, IOS-006, IOS-007, IOS-008, IOS-009, ADR-0003, DD-001 |

## Purpose

The Retry Policy SHALL retry transient provider failures deterministically while
preserving execution correctness, security, auditability, and middleware ordering.
Retry behavior SHALL be governed entirely by immutable RetryPolicy objects.

## Scope

Governs RetryPolicy, RetryClassifier, RetryStrategy, RetryCoordinator, retry
events, and retry metrics. Out of scope (future specifications): circuit breakers
(IOS-011), provider health management (IOS-013), fallback (IOS-012), adaptive
retry, jitter, cost-based retry, cross-provider retry, dynamic routing.

## Responsibilities

- Wrap the provider invocation (after the security middleware) and re-invoke it on
  a transient, retryable failure, up to the policy's attempt bound.
- Classify failures deterministically; back off deterministically (no jitter).
- Preserve the execution context and request identity across attempts.
- Publish retry events and collect retry metrics; terminate deterministically.

## Integration

Retry attaches through the IOS-004 `aroundInvoke` provider-invocation hook (added
by ADR-0003) at priority 2.5 — after the security middleware, around the provider.
It re-invokes ONLY the provider (`next`); the request/response interceptors
(security, validation) run once around the whole invocation, so retry never
bypasses them and never re-runs routing or changes provider selection. Security
rejections (firewall/PII) and validation failures occur outside the provider
invocation and therefore never reach retry.

## Public Interfaces

- `RetryPolicy`, `RetryPolicyStore` (immutable): enabled, maxAttempts,
  initialDelayMs, maxDelayMs, backoff (fixed|exponential), retryableErrorClasses,
  retryableProviders, retryableWorkloads, bypass.
- `RetryMiddleware` (implements `ExecutionHook.aroundInvoke`), `RetryCoordinator`.
- `isRetryableUnder` (classifier), `computeDelayMs` (strategy).
- Retry events (`retry.started`, `retry.attempt`, `retry.succeeded`,
  `retry.exhausted`, `retry.bypassed`); `isRetryEvent`.
- `RetryMetricsCollector`.

## Invariants

- Retry SHALL occur ONLY for transient kinds in `retryableErrorClasses` (default:
  timeout, rate_limit, provider_unavailable). It SHALL NOT retry authentication,
  validation, security, cancellation, or generic execution errors.
- Classification and backoff SHALL be deterministic (no jitter).
- Retry SHALL preserve request identity, routing decisions, middleware ordering,
  auditability, and deterministic execution.
- Retry SHALL NOT change provider selection, re-run routing, or bypass security,
  validation, telemetry, or audit.
- The RetryPolicy SHALL be immutable during execution; default disabled (no-op).

## Dependencies

- IOS-004 v1.1 (`aroundInvoke`), IOS-005 (event bus); conforms to IOS-003,
  IOS-006, IOS-007, IOS-008, IOS-009 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A retryable timeout/rate-limit SHALL be retried and SHALL succeed if a later
   attempt succeeds.
2. Retries SHALL be exhausted at `maxAttempts`, returning the normalized failure.
3. An authentication failure SHALL NOT be retried.
4. A security rejection SHALL never reach retry (no provider call, no retry events).
5. Retry events and metrics SHALL be produced.
6. Backoff SHALL be deterministic (fixed / exponential, bounded by maxDelayMs).
7. Retry SHALL compose with security and validation (each runs once per execution).
8. A disabled policy SHALL be a no-op; all existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0003 (provider-invocation extension point — enables IOS-010); ADR-0001,
  ADR-0002.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/retry/*` (retry-types, retry-classifier, retry-strategy,
  retry-events, retry-coordinator, retry-middleware, retry-metrics,
  retry-bootstrap); the `aroundInvoke` hook in
  `src/lib/aiops/execution/inference-pipeline.ts` + `execution-types.ts`; wired in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/retry-policy.test.ts`.
