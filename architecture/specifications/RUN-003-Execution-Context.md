# RUN-003 — Execution Context (`ProcessorRunContext`)

| Field | Value |
|-------|-------|
| Identifier | RUN-003 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-001, RUN-004, RUN-006, RUN-009 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define **`ProcessorRunContext`**: the immutable context threaded through a single
processor run. It binds processor identity, tenant/actor, resolved runtime profile,
correlation identifiers, and governance context — without colliding with the IOS
`InferenceExecutionContext`.

## Scope

- The `ProcessorRunContext` fields and immutability rules.
- Correlation to existing contexts (`ActorContext`, and — when a processor calls
  inference — the downstream `InferenceExecutionContext`).
- Propagation of run identity into observability and audit.

## Non-Goals

- SHALL NOT define, replace, or alias the IOS `InferenceExecutionContext`,
  `FunctionExecutionContext`, or `TransformContext`.
- SHALL NOT introduce the bare name `ExecutionContext` (AS-003 R10).
- SHALL NOT carry mutable state or live handles (transport-agnostic, RUN-004).

## Normative Requirements

- **RUN-003/1.** A `ProcessorRunContext` SHALL be immutable once created (AS-003 R9).
- **RUN-003/2.** It SHALL carry, at minimum: `runId`, `processorKey`, `processorVersion`,
  `tenantId`, optional `actorUserId`, the resolved `RuntimeProfile` reference (RUN-004),
  the active `IncrementalMode` (RUN-005), and a governance/clearance context (RUN-006).
- **RUN-003/3.** It SHALL NOT contain non-serializable handles (DB clients, sockets,
  provider clients); such resources SHALL be injected at the execution boundary, not the
  context, to preserve runtime portability (RUN-004).
- **RUN-003/4.** When a processor calls inference, it SHALL do so via `executeInference`;
  the resulting `InferenceExecutionContext` is a **separate, downstream** context and
  SHALL NOT be merged into or mutated by `ProcessorRunContext` (AS-003 R5).
- **RUN-003/5.** Observation of a run SHALL read from `ProcessorRunContext` only; it
  SHALL NOT mutate it or alter the run outcome (AS-003 R8).
- **RUN-003/6.** `runId` SHALL be deterministic-friendly: stable correlation across
  retries of the same logical run SHALL be expressible without perturbing deterministic
  clocks or identifiers.
- **RUN-003/7 (SHOULD).** `ProcessorRunContext` SHOULD be derivable from an
  `ActorContext` to reuse existing tenant/permission resolution.
- **RUN-003/8 (MAY).** It MAY carry an opaque trace-correlation id for linking to
  `RuntimeTrace` and the execution event bus as a subscriber (never as a modifier).

## Proposed Public Surface (illustrative)

`ProcessorRunContext`, `ProcessorRunId`, `fromActorContext()` (adapter).

## Dependency Direction

Depends on RUN-004/005/006 contracts and `ActorContext`. Lower layers SHALL NOT depend
on RUN-003.

## Compatibility with AS-001 / IOS

Strictly parallel to IOS contexts; no IOS context is referenced, extended, or renamed.
The two contexts coexist; inference remains single-path.

## Additive-Only Constraints

New context type; existing contexts untouched; opt-in.

## Conformance Hooks

- C1: `ProcessorRunContext` is frozen/immutable after creation.
- C2: it contains no non-serializable handle.
- C3: an inference call from within a processor produces a distinct
  `InferenceExecutionContext` and does not mutate the `ProcessorRunContext`.
- C4: RUN-003 exports no bare `ExecutionContext` identifier.

## Dependencies

Constitution v1.0; AS-003; RUN-001; RUN-004; RUN-005; RUN-006.

## Open Questions

- Exact `runId` derivation and retry-correlation scheme.
- Whether clearance context is embedded by value or by reference (RUN-006).
