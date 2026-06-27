# Milestone 6.0 — Security Middleware Platform

The enterprise security layer. Every inference now passes through a deterministic
security stage before reaching a provider, and every response is validated before
returning to the application — implemented **entirely as execution middleware**
on the existing pipeline + event bus. No provider, routing, or application
changes.

```
Application → Governed Routing → Execution Pipeline
                                      │
                BeforeExecute (observe) → interceptRequest
                                      │        1. Prompt Firewall
                                      │        2. PII Redaction
                                      ▼
                                  Provider
                                      │
                interceptResponse → AfterExecute (observe)
                  3. Response Validator     4. Event Publisher
                                      │
                          Execution Event Bus
                                      ▼
              Telemetry · Audit · Metrics · Health · Security Metrics
```

## How security attaches without changing execution

Milestone 5.x middleware were observation-only. Security needs to **inspect,
redact, and reject**, so the hook contract gained two optional interceptors that
the pipeline runs in priority order:

- `interceptRequest(request, ctx)` — runs after the BeforeExecute observers and
  **before the provider**. Returns the request the provider should receive (same,
  or a transformed copy); throwing rejects the execution. It never mutates the
  caller's request object.
- `interceptResponse(response, ctx)` — runs after the provider and **before the
  AfterExecute observers**; throwing rejects the execution.

When no hook implements an interceptor (every pre-6.0 path), the request reaches
the provider unchanged and behavior is byte-for-byte identical. Security
middleware *may* inspect / validate / reject / redact; they **never** reroute,
retry, optimize, or change provider selection.

## Deliverables

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | **Prompt Firewall** — rule-based detection (injection, instruction override, jailbreak, recursive expansion, system-prompt extraction, tool manipulation, credential exfiltration) + allow/deny lists; modes off/detect/enforce. No LLM classification. | `security/prompt-firewall.ts` |
| 2 | **PII Redaction** — email/phone/SSN/credit-card (Luhn)/API-key/access-token/IP + custom patterns; policies off/detect/mask/reject. No persistence, no external services. | `security/pii-redaction.ts` |
| 3 | **Response Validator** — UTF-8, max payload size, required JSON / fields, minimal JSON-schema, business invariants → normalized errors. | `security/response-validator.ts` |
| 4 | **Security Policy** — enabled middleware, firewall mode, PII policy, validation policy, allow/deny lists; immutable snapshots via `SecurityPolicyStore`. | `security/security-types.ts` |
| 5 | **Security Events** — `prompt_inspected`, `pii_detected`, `pii_masked`, `validation_succeeded`, `validation_failed`, published on the Execution Event Bus. | `security/security-events.ts` |
| 6 | **Security Metrics** — passive counters (prompts inspected/rejected, PII detected/masked, validation success/failure + rate). | `security/security-metrics.ts` |
| 7 | **Middleware ordering** — firewall (1) → PII (2) → validator (3) → publisher (10), explicit and tested. | `security/security-types.ts` (`SECURITY_PRIORITY`) |
| 8 | **Tests** | `tests/unit/security-middleware.test.ts` |

## Events on the shared bus

Security events ride the same Execution Event Bus as execution events, so they
are automatically observable through telemetry and audit. The bus is typed to a
structural `BusEvent` base; subscribers narrow with `isExecutionEvent` /
`isSecurityEvent`, so the execution subscribers ignore security events and the
new `SecurityMetricsCollector` counts them. A security/validation rejection is
**not** a provider fault, so the health collector ignores those error kinds —
provider health stays accurate.

## Default policy is non-disruptive

`installSecurityMiddleware()` (wired into runtime bootstrap after observability)
applies a default policy that keeps the layer fully active without touching
legitimate traffic: firewall **enforce** on malicious patterns only, PII
**detect** (no prompt mutation), validator **enforce** with permissive invariants
(valid UTF-8, large size cap). Tenants tighten it (mask/reject PII, add schemas,
deny lists) by reconfiguring the immutable policy.

## Normalized rejections

Firewall/PII rejections raise `SecurityViolationError` (kind `security_violation`);
validation failures raise `ResponseValidationError` (kind `validation_failed`).
Both are non-retryable and flow through the standard normalized-failure path.

## Verification

- **Full suite: 265 unit + 163 integration = 428 pass / 0 fail** (2 pre-existing
  skips), with the security layer globally active — including every demo and
  domain workflow (real inference paths). `next build` green · `tsc` green ·
  gitleaks clean.
- Dedicated tests cover injection/jailbreak detection, PII mask/reject/detect,
  validation success/failure, middleware ordering, security-event publication,
  health isolation, and **benign traffic being unchanged**.

## Out of scope (later milestones)

Prompt optimization · prompt/semantic cache · circuit breakers · retry/failover ·
cost optimization · benchmark harness · drift detection · explainability ·
adaptive routing · LLM-based prompt classification. Each attaches later as
additional middleware or bus subscribers without revisiting the core.
