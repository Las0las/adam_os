# IOS-018 — Model Capability Registry (Implementation of IOS-002)

| Field | Value |
|-------|-------|
| Identifier | IOS-018 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-001, IOS-002 (implements), IOS-003, IOS-014, IOS-017, ADR-0001 |

## Purpose

IOS-018 IMPLEMENTS and operationalizes the **IOS-002 Model Capability Registry**
contract. IOS-002 remains the normative architectural definition; IOS-018 becomes
the canonical producer of **ModelCapability** and **ModelDescriptor** metadata,
derived declaratively from published provider declarations. It is observational and
declarative; it SHALL NOT influence routing. Governed Routing continues to consume
published capability metadata through the existing IOS-001/002 contracts.

## Scope

Governs the ModelCapabilityRegistry (producer), the ModelCapability record, the
capability store, and capability derivation/enrichment. Out of scope: routing
decisions (IOS-003), provider invocation, learned/adaptive capability inference,
and persistence beyond the in-memory store. It does NOT redefine the IOS-002
ModelDescriptor/CapabilitySet contracts — it reuses them.

## Responsibilities

- Derive canonical ModelCapability records from the published provider declarations
  (ModelDescriptor / CapabilitySet, IOS-002).
- Optionally enrich records with DECLARATIVE benchmark (IOS-014) and evaluation
  (IOS-017) observation summaries — never altering capability eligibility used by
  routing.
- Expose the canonical capability + descriptor metadata read-only to consumers.

## Public Interfaces

- `ModelCapability`, `deriveCapability(descriptor)`, `capabilityKey(provider,model)`.
- `ModelCapabilityRegistry` (producer): `buildFrom(providerRegistry)`,
  `enrichFromBenchmark(results)`, `enrichFromEvaluation(reports)`, `capabilities()`.
- `ModelCapabilityStore` (read-only access: `get`, `descriptor`, `all`,
  `descriptors`, `byProvider`).
- Reuses the IOS-002 `ModelDescriptor`, `CapabilitySet`, `capabilitySetOf`.

## Canonical Object Contract

- **Canonical Objects Consumed** (read by reference, never mutated): published
  provider declarations / provider metadata (RegisteredProvider, ModelDescriptor —
  IOS-001/002), BenchmarkResult (IOS-014), EvaluationReport/evaluation metadata
  (IOS-017).
- **Canonical Objects Produced**: ModelCapability (new canonical object) and
  ModelDescriptor metadata — IOS-018 is their canonical producer, implementing the
  IOS-002 contract.
- **Existing Contracts Reused**: IOS-002 canonical contracts (`ModelDescriptor`,
  `CapabilitySet`, `capabilitySetOf`); IOS-001 Provider Registry.
- **Implements**: IOS-002 Model Capability Registry (operationalization; IOS-002
  remains the normative definition and is NOT superseded).
- **Authoritative Producers** (of consumed objects): the Provider Registry
  (IOS-001/002) owns provider declarations + ModelDescriptor; Benchmark Harness
  (IOS-014) owns BenchmarkResult; Evaluation Engine (IOS-017) owns EvaluationReport.
  This registry SHALL NOT mutate any of them.
- **Authorized Consumers** (of produced objects): Governed Routing MAY consume
  published capability metadata (through the existing IOS-001/002 contracts);
  explainability, benchmark, evaluation, and operator/UI surfaces MAY read
  ModelCapability. Consumers SHALL NOT mutate published records.

## Invariants

- The registry SHALL be declarative: it SHALL NOT influence routing, invoke
  providers, or alter any consumed object.
- ModelCapability records SHALL be immutable once produced.
- Capability eligibility used by routing SHALL remain governed by IOS-001/002;
  benchmark/evaluation enrichment is observational metadata only.

## Dependencies

- IOS-001 (provider registry), IOS-002 (capability contract — implemented); reads
  IOS-014 / IOS-017 observations; conforms to IOS-003 (routing unaffected) · AS-001
  · Constitution v1.0.

## Conformance Requirements

1. Capabilities SHALL be derived from published provider declarations, matching the
   descriptor's capability set, context window, pricing, and deprecation.
2. The registry SHALL expose both ModelCapability records and the ModelDescriptor
   metadata it produces.
3. Benchmark and evaluation observations SHALL enrich records declaratively
   (producing new immutable records), without affecting routing eligibility.
4. The routing engine SHALL NOT depend on the capability registry (routing is
   unaffected).

### Canonical Object Contract conformance (mandatory)

5. **Read-only consumption** — building/enriching SHALL NOT mutate the consumed
   provider declarations, BenchmarkResults, or EvaluationReports.
6. **Exclusive production** — ModelCapability records SHALL be produced ONLY by this
   registry and SHALL be immutable once produced.
7. **No authority inversion** — the registry SHALL NOT route, select, or invoke
   providers; producing capability metadata confers no routing authority.
8. **Dependency direction (AS-001)** — it SHALL depend only on IOS-001/002 contracts
   and IOS-014/017 observations; routing (IOS-003) SHALL NOT depend on it.
9. **No mutation of unowned objects** — it SHALL NOT mutate ModelDescriptor inputs,
   BenchmarkResult, or EvaluationReport (objects it does not own).

## Related ADRs

- ADR-0001 (governance framework). (No new ADR: implemented through the published
  IOS-001/002 contracts.)

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/capability/*` (capability-types, capability-store,
  capability-registry, capability-bootstrap); reuses
  `src/lib/aiops/providers/provider-registry-types.ts` (IOS-002); installed in
  `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/capability-registry.test.ts`.
