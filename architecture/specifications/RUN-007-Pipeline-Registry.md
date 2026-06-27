# RUN-007 — Pipeline Registry

| Field | Value |
|-------|-------|
| Identifier | RUN-007 |
| Version | 0.2 |
| Status | Draft |
| Authority | Normative Specification (Constitutional Runtime Contract) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, RUN-000, ADR-0005 |

> Constitutional runtime contract. Normative sections define **what must be true**, not
> how. Implementation guidance appears only under Implementation Notes (non-normative).
> Terminology follows RFC-2119. No implementation until ratified and ADR-0005 approved.

## Purpose

Define the canonical **`PipelineRegistry`**: the governed catalog of registered
processors and processor pipelines (declared compositions of processors), resolvable by
identity, following the platform's established registry pattern.

## Scope

**In scope:** registration and resolution of `ProcessorContract`s and `ProcessorPipeline`s;
the registry lifecycle (idempotent registration; global-singleton survival across
bundling); the `ProcessorPipeline` / `ProcessorPipelineNode` composition objects.

**Out of scope (Non-Goals):** replacing existing registries (transform, parser,
object-mapper, function, provider, action); redefining `PipelineDefinition` /
`PipelineRun` data types; executing pipelines (execution is RUN-001/003 + RUN-008).

## Canonical Object Contract

### Objects Owned
- `PipelineRegistry` — the process-global catalog.
- `ProcessorPipeline` — a declared acyclic composition of processors.
- `ProcessorPipelineNode` — a node referencing one processor by contract.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| `ProcessorContract` | RUN-001 |
| `RuntimeProfile` (per-node override) | RUN-004 |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `PipelineRegistry` | bootstrap registration (append-only), runtime executor, RUN-010 |
| `ProcessorPipeline` / `ProcessorPipelineNode` | runtime executor, RUN-008 |

## Normative Interfaces

- **RUN-007/1.** The registry SHALL register and resolve processors and pipelines by
  identity (`key` + `version`).
- **RUN-007/2.** A `ProcessorPipeline` SHALL be a directed **acyclic** composition whose
  every `ProcessorPipelineNode` references a registered `ProcessorContract`.
- **RUN-007/3.** Registration SHALL be wired only through the sanctioned additive
  registration aggregation point (append-only side-effect import).

## Runtime Invariants

- **INV-007.1 (Idempotent registration).** Re-registering an identical entry SHALL be a
  no-op; a conflicting re-registration SHALL raise a typed `RegistryConflictFault`
  (RUN-009).
- **INV-007.2 (Singleton survival).** The registry SHALL be a process-global singleton
  that survives bundling and is deterministically rebuildable from side-effect imports
  (serverless/edge safe).
- **INV-007.3 (Acyclicity).** A pipeline containing a cycle SHALL be rejected at
  registration.
- **INV-007.4 (Pure resolution).** Resolution SHALL perform no I/O and SHALL NOT mutate the
  resolved contract (immutability, AS-003 R9).
- **INV-007.5 (No reverse dependency).** No lower layer SHALL import the registry; the only
  existing-file touchpoint is the append-only registration aggregation import (AS-003 R4).
- **INV-007.6 (Contract integrity).** A node SHALL reference a processor by contract; the
  registry SHALL NOT inline behavior or bypass the processor contract.

## Conformance Requirements

- **RUN-007/C1.** Idempotent re-registration is a no-op; conflicting re-registration
  throws a typed fault.
- **RUN-007/C2.** A cyclic pipeline declaration is rejected at registration.
- **RUN-007/C3.** The registry survives a simulated bundling/global reset via side-effect
  re-import.
- **RUN-007/C4.** No lower-layer module imports the registry (dependency-direction test).
- **RUN-007/C5.** RUN-007 exports no bare `Pipeline` identifier (AS-003 R10).

## Related Specifications

RUN-000, RUN-001 (processors), RUN-004 (overrides), RUN-008 (consumes pipelines), RUN-009.

## Related ADRs

ADR-0005 (establishing); ADR-0003 (IOS registries untouched).

## Implementation Notes (non-normative)

- SHOULD mirror the existing `globalThis`-anchored registry pattern (provider/function/
  action registries) for singleton survival.
- Likely surface: `registerProcessor`, `resolveProcessor`, `registerPipeline`,
  `resolvePipeline`, `listProcessors`.
- Introspection MAY be exposed for governance/conformance tooling without exposing mutable
  internals.
