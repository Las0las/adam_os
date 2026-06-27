# Milestone 5.0 — Execution Observability Platform

The platform's **passive observation layer**. Every inference flowing through the
execution pipeline (Milestone 4.x) now automatically produces telemetry, metrics,
immutable audit records, and provider-health observations — **without changing
any execution, routing, provider, or application behavior**. This milestone adds
no optimization, caching, or security; it establishes the contracts those future
layers attach to.

## Architecture

Everything attaches through **execution middleware** — named, priority-ordered
observers registered into the existing hook registry. The pipeline remains the
only provider-invocation path; middleware sits in the chain around the provider
call and observes only.

```
Execution Pipeline
   ↓
Middleware Chain   (telemetry → audit → health, by priority)
   ↓
Provider Adapter
   ↓
Provider SDK
```

**Observation must never alter execution.** Every middleware wraps its work in a
`guard()` that swallows errors, so an observer bug can never turn a success into
a failure. Observability timestamps read the wall clock (`Date.now()`), never the
platform's deterministic monotonic clock, so observation cannot perturb id /
timestamp sequences.

## Deliverables

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | **Telemetry Engine** — subscribes to Before/After/Failed, captures canonical events, fans out to subscribers (no persistence) | `observability/telemetry-engine.ts` |
| 2 | **Execution Events** — `ExecutionStarted` / `ExecutionCompleted` / `ExecutionFailed` | `observability/execution-events.ts` |
| 3 | **Metrics Collector** — passive running totals fed by telemetry events | `observability/metrics-collector.ts` |
| 4 | **Audit Engine** — immutable `AuditRecord` (request/response fingerprints, no persistence/encryption) | `observability/audit-engine.ts` |
| 5 | **Passive Health Collector** — observes outcomes, updates `ProviderHealth` (no routing influence) | `observability/health-collector.ts` |
| 6 | **Middleware** — formal `ExecutionMiddleware` chain abstraction | `observability/execution-middleware.ts` |
| 7 | **Hook Registry** — now priority-ordered | `execution/execution-hooks.ts` |
| 8 | **Architecture Tests** | `tests/unit/execution-observability.test.ts` |

### Canonical events

Each event carries `executionId`, `requestId`, `tenantId`, `provider`, `model`,
`workloadType`, `timestamp`. Additionally:

- **ExecutionCompleted** — `latency`, token `usage` (prompt / completion / total /
  cost), `finishReason`.
- **ExecutionFailed** — normalized `error` and a `retryable` flag (transient kinds
  — timeout, rate-limit, provider-unavailable — are retryable; auth / cancelled /
  execution-failed are not). No retry is performed; this is classification only.

### Audit record

`{ executionId, requestId, tenantId, routingDecision, selectedProvider,
selectedModel, requestFingerprint, responseFingerprint, executionResult,
timestamps }` — deep-frozen on construction. Fingerprints are stable,
non-cryptographic digests (FNV-1a over canonical JSON): they capture request /
response **identity** without retaining prompt or response text. Not encryption,
not a security control.

### Hook / middleware ordering

The registry sorts hooks by ascending `priority` (default `0`), with registration
order as a stable tie-break — so pre-existing hooks (all priority 0) keep their
previous behavior. The three core middleware take fixed positions: telemetry
(10) → audit (20) → health (30).

## Wiring

`installExecutionObservability()` (called from `ensureBootstrapped()` /
`initRuntime()`) instantiates the process-wide stack and registers the three
middleware exactly once. The metrics collector subscribes to the telemetry
engine, so the data flow is `telemetry → metrics`. The stack lives on
`globalThis` so Next.js chunk duplication can't split observation.

## Explicitly out of scope

Prompt/semantic cache · prompt firewall · PII redaction · response validation ·
circuit breakers · retry/failover · cost/prompt optimization · benchmark harness ·
traffic replay · drift detection · A/B evaluation · explainability · dashboards ·
persistence. Each depends on this layer and attaches as future middleware.

## Success criteria

- Every inference automatically produces telemetry, metrics, audit, and health
  observations.
- Execution, routing, providers, and applications are unchanged — additive only.
- Execution contracts stay immutable; behavior stays deterministic.
- All existing tests pass unchanged (full unit suite green, plus the new
  observability suite).
