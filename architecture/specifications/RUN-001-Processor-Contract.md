# RUN-001 — Processor Contract

| Field | Value |
|-------|-------|
| Identifier | RUN-001 |
| Version | 0.2 |
| Status | Draft |
| Authority | Normative Specification (Constitutional Runtime Contract) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, RUN-000, ADR-0005 |

> Constitutional runtime contract. The normative sections define **what must be true**,
> never how it is implemented. Implementation guidance appears only under Implementation
> Notes (non-normative). Terminology follows RFC-2119. No implementation SHALL begin
> until AS-003 and this specification are ratified and ADR-0005 is approved.

## Purpose

Define the **ProcessorContract**: the single canonical declaration of a governed runnable
unit of data/computation work in LAWRENCE. The Processor Contract is the constitutional
anchor of the Runtime Library — every other RUN object is either declared by, consumed
by, or produced for a processor.

## Scope

**In scope:** processor identity; the canonical `ProcessorContract` object; the binding of
a processor to its input/output contracts (RUN-002), runtime requirements (RUN-004),
incremental semantics (RUN-005), and governance markings (RUN-006); the normative
execution-entry obligation; adapter obligations over existing narrow contracts.

**Out of scope (Non-Goals):** defining input/output schemas (RUN-002), context
(RUN-003), profiles (RUN-004), materialization (RUN-008), or registration (RUN-007);
altering any existing contract; any inference invocation path.

## Canonical Object Contract

### Objects Owned
- `ProcessorContract` — the declaration of a runnable unit.
- `ProcessorIdentity` — `{ key, version }`, stable and tenant-agnostic.
- `ProcessorKind` — the enumerated classification of a processor.
- `ProcessorAdapter` — an adapter presenting an existing narrow contract as a processor.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| `InputContract` / `InputSetContract` | RUN-002 (declared by this processor) |
| `OutputContract` / `OutputSetContract` | RUN-002 (declared by this processor) |
| `ProcessorRunContext` | RUN-003 (runtime executor) |
| `RuntimeRequirement` | RUN-004 (declared by this processor) |
| `IncrementalSemantics` | RUN-005 (declared by this processor) |
| `MarkingSet` / `MarkingPropagationRule` | RUN-006 |
| existing narrow contracts (`PipelineTransform`, `LawrenceFunction`, …) | DataOps / AIOps (adapted, unchanged) |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `ProcessorContract` | RUN-007 (registry), runtime executor, RUN-008, RUN-010 |
| `ProcessorIdentity` / `ProcessorKind` | RUN-007, RUN-009, RUN-010 |

## Normative Interfaces

- **RUN-001/1.** A `ProcessorContract` SHALL expose a stable `ProcessorIdentity`
  (`key` unique and tenant-agnostic; `version` monotonic) and a `ProcessorKind`.
- **RUN-001/2.** A `ProcessorContract` SHALL declare exactly one input contract or input
  set contract and exactly one output contract or output set contract (RUN-002).
- **RUN-001/3.** A `ProcessorContract` SHALL declare its `RuntimeRequirement` set
  (RUN-004), its `IncrementalSemantics` (RUN-005), and its `MarkingPropagationRule`
  (RUN-006).
- **RUN-001/4.** A `ProcessorContract` SHALL expose exactly one execution entry that is a
  function of (validated inputs, resolved contracts, `ProcessorRunContext`) and returns a
  contract-conformant output or raises a typed `RuntimeException` (RUN-009).
- **RUN-001/5.** A `ProcessorAdapter` SHALL present an existing narrow contract as a
  `ProcessorContract` without altering the wrapped unit's observable behavior.

## Runtime Invariants

- **INV-001.1 (Declared, not inferred).** Every contract property of a processor SHALL be
  explicitly declared; nothing SHALL be inferred from key, path, or provider name.
- **INV-001.2 (Determinism).** Given identical inputs, resolved contracts, and profile, a
  processor SHALL produce identical output.
- **INV-001.3 (Safe defaults).** An undeclared optional property SHALL resolve to its most
  restrictive safe value, never its most permissive.
- **INV-001.4 (No provider path).** A processor SHALL NOT invoke a provider directly and
  SHALL NOT add or modify an IOS execution seam; inference is a downstream call to
  `executeInference`.
- **INV-001.5 (Adapter equivalence).** An unwrapped narrow contract SHALL behave
  identically to today; a pass-through processor SHALL yield identical output to invoking
  the wrapped unit directly.
- **INV-001.6 (Identity stability).** `ProcessorIdentity` SHALL be immutable once
  published; a behavior change SHALL increment `version`.
- **INV-001.7 (No direct reality mutation).** A processor's effect on the world SHALL be a
  `ProcessorEffect` (RUN-011): a `ProjectionWrite` to a disposable projection, or a
  `CommandIntent` realized only by an accepted event. A processor SHALL NOT mutate ontology
  objects directly (Principle 0 §9; Axioms 1–3).

## Conformance Requirements

- **RUN-001/C1.** An unwrapped `PipelineTransform`/`LawrenceFunction` behaves identically
  to today (`/conformance/run/contract`).
- **RUN-001/C2.** A pass-through `ProcessorContract` over a wrapped unit yields identical
  output.
- **RUN-001/C3.** Undeclared optional properties resolve to the most restrictive default.
- **RUN-001/C4.** RUN-001 exports no bare `Processor`, `Function`, or `Pipeline`
  identifier (AS-003 R10).
- **RUN-001/C5.** A processor never reaches a provider except via `executeInference`.
- **RUN-001/C6.** A processor performs no direct ontology mutation; its world-effect is a
  `ProcessorEffect` (RUN-011).

## Related Specifications

RUN-000 (ownership), RUN-002, RUN-003, RUN-004, RUN-005, RUN-006, RUN-007, RUN-009,
RUN-011 (effect boundary).

## Related ADRs

ADR-0005 (establishing); ADR-0006 (Principle 0 boundary); ADR-0003 (IOS boundary
preserved).

## Implementation Notes (non-normative)

- A likely shape: `interface ProcessorContract { identity; kind; input; output;
  requirements; incremental; markingRule; run(ctx, input): Promise<Output> }`.
- Adapters (`transform-processor-adapter`, `function-processor-adapter`) SHOULD wrap, not
  reimplement, existing units; the originals remain the source of behavior.
- `ProcessorKind` MAY map to existing classifications (transform, function `klass`,
  mapper, parser, action) without renaming them.
