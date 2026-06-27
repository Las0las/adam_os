# RUN-007 — Pipeline Registry

| Field | Value |
|-------|-------|
| Identifier | RUN-007 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-001, RUN-004, RUN-008 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define the **`PipelineRegistry`**: a governed catalog of registered processors and
processor pipelines (declared compositions of processors), resolvable by key, following
the platform's established registry pattern.

## Scope

- Registration and resolution of `ProcessorContract`s and processor pipelines.
- The registry lifecycle (idempotent registration; global-singleton survival across
  bundling) consistent with existing registries.
- Pipeline composition declarations (nodes = processors, edges = data dependencies).

## Non-Goals

- SHALL NOT replace existing registries (transform, parser, object-mapper, function,
  provider, action); the `PipelineRegistry` is a new sibling registry.
- SHALL NOT redefine `PipelineDefinition` / `PipelineRun` data types; it MAY reference
  them.
- SHALL NOT execute pipelines (execution is RUN-001/003 + RUN-008).

## Normative Requirements

- **RUN-007/1.** Registration SHALL be idempotent and keyed by processor/pipeline `key`
  (+`version`). Re-registration of an identical entry SHALL be a no-op; a conflicting
  re-registration SHALL raise a typed Runtime Exception (RUN-009).
- **RUN-007/2.** The registry SHALL be a process-global singleton that survives bundling
  (mirrors existing `globalThis`-anchored registries) so serverless/edge runtimes can
  rebuild it deterministically from side-effect imports.
- **RUN-007/3.** Resolution SHALL be deterministic and SHALL NOT perform I/O or mutate
  the resolved contract (immutability, AS-003 R9).
- **RUN-007/4.** A pipeline declaration SHALL be a directed acyclic composition of
  registered processors; cycles SHALL be rejected at registration with a typed exception.
- **RUN-007/5.** Registration SHALL be wired only through the sanctioned additive
  registration aggregation point (append-only side-effect import); lower layers SHALL NOT
  import the registry (AS-003 R4).
- **RUN-007/6.** Each pipeline node SHALL reference a processor by contract; the registry
  SHALL NOT inline behavior or bypass the processor contract.
- **RUN-007/7 (SHOULD).** The registry SHOULD expose list/introspection for governance
  and conformance tooling without exposing mutable internals.
- **RUN-007/8 (MAY).** A pipeline MAY declare per-node runtime profile overrides (RUN-004)
  subject to the same matching rules.

## Proposed Public Surface (illustrative)

`PipelineRegistry`, `registerProcessor()`, `resolveProcessor()`, `registerPipeline()`,
`resolvePipeline()`, `listProcessors()`. (No bare `Pipeline` export — AS-003 R10.)

## Dependency Direction

Depends on RUN-001/004 contracts. Lower layers SHALL NOT depend on RUN-007. The only
existing-file touchpoint is the append-only registration aggregation import.

## Compatibility with AS-001 / IOS

Independent of IOS registries (provider/model). Naming distinct: no existing
`PipelineRegistry` symbol exists.

## Additive-Only Constraints

New registry alongside existing ones; existing registries unchanged; opt-in registration.

## Conformance Hooks

- C1: idempotent re-registration is a no-op; conflicting re-registration throws.
- C2: cyclic pipeline declaration is rejected at registration.
- C3: registry survives a simulated bundling/global reset via side-effect re-import.
- C4: no lower-layer module imports the registry (dependency-direction test).

## Dependencies

Constitution v1.0; AS-003; RUN-001; RUN-004.

## Open Questions

- Whether pipelines are versioned independently of their member processors.
- Whether registry introspection is public contract or governance-tooling-only.
