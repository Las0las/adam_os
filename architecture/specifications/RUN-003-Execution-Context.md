# RUN-003 — Execution Context (`ProcessorRunContext`)

| Field | Value |
|-------|-------|
| Identifier | RUN-003 |
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

Define the canonical **`ProcessorRunContext`**: the immutable context threaded through a
single processor run, binding processor identity, tenant/actor, resolved runtime profile,
incremental mode, governance/clearance context, and correlation identity — distinct from
the IOS `InferenceExecutionContext`.

## Scope

**In scope:** the `ProcessorRunContext` and `ProcessorRunId` objects; their immutability
and serializability obligations; correlation to `ActorContext` and (downstream) to the
IOS inference context; propagation of run identity to observation and audit.

**Out of scope (Non-Goals):** defining, replacing, or aliasing the IOS
`InferenceExecutionContext`, `FunctionExecutionContext`, or `TransformContext`;
introducing the bare name `ExecutionContext`; carrying mutable state or live handles.

## Canonical Object Contract

### Objects Owned
- `ProcessorRunContext` — immutable per-run context.
- `ProcessorRunId` — stable run correlation identity.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| `RuntimeProfile` (reference) | RUN-004 |
| `IncrementalMode` | RUN-005 |
| `ClearanceDecision` / clearance context | RUN-006 |
| `ActorContext` | Platform / app (external) |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `ProcessorRunContext` | RUN-001 entry point, RUN-008, observability subscribers |
| `ProcessorRunId` | RUN-008, RUN-009, observability/audit |

## Normative Interfaces

- **RUN-003/1.** A `ProcessorRunContext` SHALL carry at minimum: `runId`, `processorKey`,
  `processorVersion`, `tenantId`, optional `actorUserId`, a `RuntimeProfile` reference
  (RUN-004), the active `IncrementalMode` (RUN-005), and a clearance context (RUN-006).
- **RUN-003/2.** A `ProcessorRunContext` SHALL be derivable from an `ActorContext` so that
  existing tenant/permission resolution is reused, not re-implemented.
- **RUN-003/3.** When a processor performs inference, it SHALL call `executeInference`; the
  resulting `InferenceExecutionContext` is a separate downstream object and SHALL NOT be
  merged into or mutate the `ProcessorRunContext`.

## Runtime Invariants

- **INV-003.1 (Immutability).** A `ProcessorRunContext` SHALL be immutable once created
  (AS-003 R9).
- **INV-003.2 (Serializability / portability).** It SHALL contain no non-serializable
  handle (DB client, socket, provider client); such resources SHALL be injected at the
  execution boundary, preserving runtime portability (RUN-004).
- **INV-003.3 (Observation safety).** Observation SHALL read the context only and SHALL
  NOT mutate it or alter the run outcome (Art. IV).
- **INV-003.4 (Context separation).** The processor context and any IOS inference context
  SHALL remain distinct objects; neither mutates the other.
- **INV-003.5 (Stable correlation).** `runId` SHALL allow stable correlation across
  retries of the same logical run without perturbing deterministic clocks or identifiers.

## Conformance Requirements

- **RUN-003/C1.** `ProcessorRunContext` is frozen/immutable after creation.
- **RUN-003/C2.** It contains no non-serializable handle.
- **RUN-003/C3.** An inference call from within a processor yields a distinct
  `InferenceExecutionContext` and does not mutate the `ProcessorRunContext`.
- **RUN-003/C4.** RUN-003 exports no bare `ExecutionContext` identifier (AS-003 R10).

## Related Specifications

RUN-000, RUN-001, RUN-004 (profile), RUN-005 (mode), RUN-006 (clearance), RUN-008.

## Related ADRs

ADR-0005 (establishing); ADR-0003 (IOS context unchanged).

## Implementation Notes (non-normative)

- A `fromActorContext(actor, …): ProcessorRunContext` factory SHOULD bridge existing
  `ActorContext`.
- `runId` MAY be a deterministic-friendly id; an opaque trace-correlation id MAY link to
  `RuntimeTrace` and the execution event bus as a read-only subscriber.
- Resources (db, sinks) SHOULD be passed as explicit execution-boundary parameters, not
  embedded in the context.
