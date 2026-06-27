# IOS-011 — Circuit Breaker

| Field | Value |
|-------|-------|
| Identifier | IOS-011 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-004 (v1.1), IOS-005, IOS-006, IOS-007, IOS-008, IOS-009, IOS-010, ADR-0003, DD-001 |

## Purpose

The Circuit Breaker SHALL protect an unhealthy provider/model from sustained load
by fast-failing calls once qualifying failures cross a threshold, and SHALL allow
recovery through a timed half-open probe. Behavior SHALL be governed entirely by
immutable CircuitPolicy objects and SHALL be deterministic.

## Scope

Governs CircuitPolicy, the failure classifier, the circuit state machine (closed /
open / half-open), circuit events, and circuit metrics. Out of scope (future
specifications): provider health management (IOS-013), fallback / failover
(IOS-012), adaptive thresholds, sliding-window/percentile error rates, learned
health scoring, cross-provider coupling, and dynamic routing.

## Responsibilities

- Track failures per circuit (provider + model) and trip a closed circuit to open
  once consecutive qualifying failures reach `failureThreshold`.
- While open, reject calls WITHOUT invoking the provider (a normalized
  `ProviderUnavailableError` — no new error kind is introduced).
- After `cooldownMs`, admit a single half-open probe; close on
  `successThreshold` successes, or reopen on a qualifying failure.
- Publish circuit events and collect circuit metrics.

## Integration

The Circuit Breaker attaches through the IOS-004 `aroundInvoke`
provider-invocation contract (AS-001 R9, established by ADR-0003) at priority 2.4
— after the security middleware and OUTSIDE the Retry middleware (priority 2.5):
`security → circuit breaker → retry → provider`. Composing outside retry means an
open circuit fast-fails immediately and consumes no retry attempts, and the
breaker observes one aggregate outcome per execution (retry's final result)
rather than each retry attempt. It introduces NO new execution seam; it reuses the
canonical AroundInvoke contract exactly as IOS-010 does. The request/response
interceptors (security, validation) run once around the whole invocation, so the
breaker never bypasses them and never re-runs routing or changes provider
selection. Security rejections (firewall/PII) and validation failures occur
outside the provider invocation and therefore never reach the breaker.

## Public Interfaces

- `CircuitPolicy`, `CircuitPolicyStore` (immutable): mode, failureThreshold,
  cooldownMs, successThreshold, trippingErrorClasses, eligibleProviders,
  eligibleWorkloads, bypass.
- `CircuitBreaker` (implements `ExecutionHook.aroundInvoke`); `circuitKey`,
  `circuitEligible`, `tripsCircuit`.
- Circuit events (`circuit.opened`, `circuit.closed`, `circuit.half_opened`,
  `circuit.rejected`); `isCircuitEvent`.
- `CircuitMetricsCollector`.

## Invariants

- A circuit SHALL trip ONLY on consecutive qualifying failures whose normalized
  kind is in `trippingErrorClasses` (default: timeout, rate_limit,
  provider_unavailable). It SHALL NOT trip on authentication, validation,
  security, cancellation, or generic execution errors.
- While open (before cooldown) the breaker SHALL NOT invoke the provider.
- The state machine and rejection SHALL be deterministic; the cooldown clock SHALL
  be injectable for testing.
- Circuits SHALL be isolated per provider + model (no cross-provider coupling).
- The breaker SHALL NOT change provider selection, re-run routing, or bypass
  security, validation, telemetry, or audit.
- The CircuitPolicy SHALL be immutable during execution; default disabled (no-op).

## Dependencies

- IOS-004 v1.1 (`aroundInvoke`), IOS-005 (event bus); conforms to IOS-003,
  IOS-006, IOS-007, IOS-008, IOS-009, IOS-010 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A closed circuit SHALL pass the call through to the provider unchanged.
2. Consecutive qualifying failures reaching `failureThreshold` SHALL open the
   circuit (`circuit.opened`); subsequent calls SHALL fast-fail
   (`circuit.rejected`, normalized `provider_unavailable`) WITHOUT invoking the
   provider.
3. After `cooldownMs`, a half-open probe SHALL be admitted (`circuit.half_opened`);
   `successThreshold` successes SHALL close the circuit (`circuit.closed`).
4. A qualifying failure during half-open SHALL reopen the circuit.
5. Authentication (and other non-qualifying) failures SHALL NOT trip the circuit.
6. A security rejection SHALL never reach the breaker (no provider call, no circuit
   events).
7. Circuits SHALL be isolated per provider + model.
8. When composed with retry, an open breaker SHALL fast-fail without consuming
   retry attempts (retry SHALL NOT engage under an open circuit).
9. Circuit events and metrics SHALL be produced.
10. A disabled policy (and `bypass`/ineligible execution) SHALL be a no-op; all
    existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0003 (provider-invocation extension point — reused, no further architectural
  change); ADR-0001, ADR-0002.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/circuit/*` (circuit-types, circuit-classifier, circuit-events,
  circuit-breaker, circuit-metrics, circuit-bootstrap); reuses the `aroundInvoke`
  hook in `src/lib/aiops/execution/inference-pipeline.ts` + `execution-types.ts`;
  wired in `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/circuit-breaker.test.ts`.
