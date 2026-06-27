# IOS-002 — Model Capability Registry

| Field | Value |
|-------|-------|
| Identifier | IOS-002 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-001, IOS-003, ADR-0001 |

## Purpose

The Model Capability Registry SHALL define the canonical, provider-agnostic
description of each model and its capabilities, so that governed routing can
select a model by what it can do rather than by who makes it (Constitution,
Article III §3).

## Scope

Governs `ModelDescriptor` and the derived `CapabilitySet` for every model
published by a registered provider. Excludes provider construction (IOS-001) and
selection logic (IOS-003).

## Responsibilities

- Declare per-model capabilities: vision, tools, streaming, JSON, reasoning,
  embeddings.
- Carry provider id, publisher, family, model/deployment key, version, context
  window, pricing (nullable when unpublished — never fabricated), deprecation.
- Project a descriptor into a normalized `CapabilitySet` derived ONLY from the
  descriptor.
- Validate descriptors (required fields, typed flags).

## Public Interfaces

- `ModelDescriptor`, `ModelPricing`, `CapabilitySet`.
- `capabilitySetOf(descriptor)`, `assertValidDescriptor(descriptor)`.

## Invariants

- Capabilities SHALL be DECLARED per model and SHALL NOT be inferred from a
  provider's or model's name.
- Pricing SHALL be null when not published; it SHALL NOT be invented.
- A `CapabilitySet` SHALL be a pure projection of its descriptor.

## Dependencies

- IOS-001 (descriptors are published by registered providers) · AS-001 ·
  Constitution v1.0.

## Conformance Requirements

1. `capabilitySetOf(d)` SHALL equal the boolean flags declared on `d`.
2. `assertValidDescriptor` SHALL reject a descriptor with a missing/empty
   required field or a non-boolean capability flag.
3. No code path SHALL derive a capability from the provider/model name.

## Related ADRs

- ADR-0001.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/providers/provider-registry-types.ts`
  (`ModelDescriptor`, `CapabilitySet`, `capabilitySetOf`, `assertValidDescriptor`).
