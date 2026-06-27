# IOS-006 — Security Middleware

| Field | Value |
|-------|-------|
| Identifier | IOS-006 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-004, IOS-005, IOS-007, ADR-0001 |

## Purpose

The Security Middleware SHALL provide a deterministic security layer that every
inference passes before reaching a provider, and that validates every response
before it returns — implemented entirely as execution middleware (Constitution,
Article V §3). Covers Milestone 6.0.

## Scope

Governs the prompt firewall, PII redaction, response validator, immutable
SecurityPolicy, security events, and security metrics. Excludes model-assisted
classification and tenant-specific rule packs (future specifications + ADRs).

## Responsibilities

- **Prompt Firewall** SHALL detect (rule-based, no model) prompt injection,
  instruction override, jailbreak, recursive expansion, system-prompt
  extraction, tool manipulation, and credential exfiltration, plus allow/deny
  lists; modes off/detect/enforce.
- **PII Redaction** SHALL detect and (per policy) mask or reject email, phone,
  SSN, credit card (Luhn), API keys, access tokens, IP addresses, and custom
  patterns; modes off/detect/mask/reject.
- **Response Validator** SHALL enforce UTF-8 validity, maximum payload size,
  required JSON/fields, a minimal JSON-schema, and business invariants,
  producing normalized execution errors.
- Publish canonical security events and collect passive security metrics.

## Public Interfaces

- `SecurityPolicy`, `SecurityPolicyStore` (immutable snapshots).
- `PromptFirewall`, `PIIRedaction`, `ResponseValidator` (execution middleware via
  `interceptRequest` / `interceptResponse`).
- Security events (`prompt_inspected`, `pii_detected`, `pii_masked`,
  `validation_succeeded`, `validation_failed`); `isSecurityEvent`.
- `SecurityMetricsCollector`.
- Errors: `SecurityViolationError`, `ResponseValidationError`.

## Invariants

- Security middleware MAY inspect/validate/reject/redact; it SHALL NOT reroute,
  retry, optimize, or mutate provider behavior.
- Redaction SHALL NOT mutate the caller's request object (a transformed copy is
  produced).
- A security/validation rejection SHALL be a normalized, non-retryable failure and
  SHALL NOT count as a provider fault.
- The SecurityPolicy SHALL be immutable during an execution.
- Ordering SHALL be deterministic: firewall (1) → PII (2) → provider →
  validator (3) → publisher (10).

## Dependencies

- IOS-004 (interceptors), IOS-005 (event bus) · AS-001 · Constitution v1.0.

## Conformance Requirements

1. A malicious prompt SHALL be rejected (enforce) with `security_violation` and
   the provider SHALL NOT be called.
2. PII mask mode SHALL deliver a redacted request to the provider; the original
   request object SHALL be unchanged.
3. A response failing validation SHALL yield `validation_failed`.
4. Benign traffic SHALL be byte-for-byte unchanged.

## Related ADRs

- ADR-0001.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/security/*` (prompt-firewall, pii-redaction, response-validator,
  security-types, security-events, security-metrics, security-bootstrap).
