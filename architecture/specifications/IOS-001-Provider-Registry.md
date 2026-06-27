# IOS-001 — Provider Registry

| Field | Value |
|-------|-------|
| Identifier | IOS-001 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-002, IOS-003, IOS-004, ADR-0001 |

## Purpose

The Provider Registry SHALL be the single source of truth for which inference
providers and models exist, how they authenticate, what they cost, and how a
provider adapter is constructed. It exists so that routing, execution,
governance, and evaluation depend on one declarative contract rather than on
hard-coded vendor knowledge (Constitution, Article III).

## Scope

Governs registration, configuration discovery, and construction of provider
adapters. Excludes capability declaration (IOS-002), selection (IOS-003), and
invocation (IOS-004).

## Responsibilities

- Register providers with their metadata, published model descriptors, and
  required-environment groups.
- Report whether a provider is configured (authorizable) and whether it is
  eligible to be the process default.
- Construct a provider adapter for a given model key, and the process-default
  adapter.
- Preserve deterministic registration order and prevent duplicate registration.

## Public Interfaces

- `ProviderRegistry` with `register`, `get`, `has`, `list` (priority/registration
  ordered).
- `RegisteredProvider`: `{ metadata, descriptors, requiredEnv, extraDefaultEnv?,
  defaultPriority, isConfigured(), isDefaultEligible(), create(modelKey),
  createDefault() }`.
- `ProviderMetadata`, `ProviderHealth` (status contract; monitoring owned by
  IOS-005).
- `defineProvider()` helper; per-provider registration modules + bootstrap.

## Invariants

- A registered provider SHALL be frozen on registration.
- `requiredEnv` SHALL be read lazily (at call time) so configuration changes are
  always respected.
- The registry SHALL be the ONLY authority on provider existence; no consumer
  SHALL infer providers by name.

## Dependencies

- LAWRENCE Constitution v1.0 · AS-001.

## Conformance Requirements

1. Registering a provider then resolving it SHALL return the same registered entry.
2. `isConfigured()` SHALL reflect current environment without re-registration.
3. Duplicate registration of the same id SHALL NOT create two entries.
4. `list()` SHALL preserve a deterministic order.

## Related ADRs

- ADR-0001 (framework establishment).

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/providers/provider-registry.ts`,
  `provider-registry-types.ts`, `define-provider.ts`,
  `provider-registry-bootstrap.ts`, `registrations/*`.
