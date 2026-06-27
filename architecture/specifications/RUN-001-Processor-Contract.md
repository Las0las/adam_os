# RUN-001 — Processor Contract

| Field | Value |
|-------|-------|
| Identifier | RUN-001 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-002 … RUN-010 |

> Normative Specification skeleton. Defines contracts and invariants, not
> implementation. Terminology follows RFC-2119. No implementation SHALL begin until
> AS-003 and this specification are ratified and ADR-0005 is approved.

## Purpose

Define the **ProcessorContract**: the single, unified declaration of a governed runnable
unit of data/computation work in LAWRENCE. A processor declares its identity, kind,
input/output contracts (RUN-002), runtime requirements (RUN-004), incremental semantics
(RUN-005), and governance markings (RUN-006), and exposes one deterministic execution
entry point that runs under a `ProcessorRunContext` (RUN-003).

## Scope

- The `ProcessorContract` shape and processor identity (`key`, `version`, `kind`).
- The relationship between a processor and existing narrow contracts
  (`PipelineTransform`, `LawrenceFunction`, `ObjectMapper`, `ActionHandler`,
  `ParserHandler`, `ImportAdapter`) via **adapters**.
- The processor execution entry-point signature (declared here; semantics in RUN-003).

## Non-Goals

- SHALL NOT define or alter `LawrenceFunction`, `PipelineTransform`, or any existing
  contract; processors **wrap** them via adapters and leave originals unchanged.
- SHALL NOT define inference invocation; a processor needing inference calls the IOS
  public contract (`executeInference`) downstream.
- SHALL NOT define materialization (RUN-008) or registration (RUN-007).

## Normative Requirements

- **RUN-001/1.** A `ProcessorContract` SHALL declare a stable identity: `key` (unique,
  tenant-agnostic), `version` (monotonic), and `kind` (an enumerated `ProcessorKind`).
- **RUN-001/2.** A `ProcessorContract` SHALL declare exactly one input contract or input
  set contract (RUN-002) and exactly one output contract or output set contract (RUN-002).
- **RUN-001/3.** A `ProcessorContract` SHALL declare its `RuntimeRequirement` set
  (RUN-004), `IncrementalSemantics` (RUN-005), and an optional `MarkingSet` /
  marking-propagation rule (RUN-006). Undeclared properties SHALL default to the most
  restrictive safe value, never the most permissive.
- **RUN-001/4.** A processor's execution entry point SHALL be a pure function of
  (declared inputs, resolved contracts, `ProcessorRunContext`) and SHALL be deterministic
  given identical inputs and profile (AS-003 R8).
- **RUN-001/5.** A processor SHALL NOT invoke a provider directly and SHALL NOT add or
  modify an IOS execution seam (AS-003 R1, R5).
- **RUN-001/6.** Adapters wrapping existing contracts SHALL preserve the wrapped unit's
  observable behavior; an unwrapped unit SHALL behave identically to today (AS-003 R2).
- **RUN-001/7.** The contract SHALL NOT export the bare identifiers `Processor`,
  `Function`, or `Pipeline` (AS-003 R10). Canonical type: `ProcessorContract`.
- **RUN-001/8 (SHOULD).** `ProcessorKind` SHOULD align with existing classifications
  (e.g. transform, function `klass`, mapper, parser, action) without renaming them.
- **RUN-001/9 (MAY).** A processor MAY declare optional metadata (owner, description,
  deprecation) that does not affect execution semantics.

## Proposed Public Surface (illustrative, non-binding)

`ProcessorContract`, `ProcessorKind`, `ProcessorIdentity`, `ProcessorDescriptor`,
`ProcessorAdapter`. (Names indicative; fixed at contract extraction.)

## Dependency Direction

RUN-001 depends downward only: on RUN-002/003/004/005/006 contracts and on existing
public contracts it adapts. Lower layers SHALL NOT depend on RUN-001 (AS-003 R4).

## Compatibility with AS-001 / IOS

No IOS artifact is referenced or modified. Inference, when needed by a processor, is a
downstream call to `executeInference`. ADR-0003/0004 preserved.

## Additive-Only Constraints

New types only; no edits to existing contracts; adapters preserve behavior; opt-in.

## Conformance Hooks

- C1: an unwrapped `PipelineTransform`/`LawrenceFunction` behaves identically to today.
- C2: a pass-through `ProcessorContract` over a wrapped unit yields identical output.
- C3: undeclared governance/runtime properties resolve to the most restrictive default.
- C4: RUN-001 exports no bare `Processor`/`Function`/`Pipeline` identifier.

## Dependencies

LAWRENCE Constitution v1.0; AS-003; RUN-002 … RUN-006.

## Open Questions

- Whether `ProcessorKind` is a closed enum or an open registry.
- Whether versioning is per-processor semver or a monotonic integer.
