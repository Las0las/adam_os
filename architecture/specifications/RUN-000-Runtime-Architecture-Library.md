# RUN-000 — Runtime Architecture Library (Index & Canonical Object Ownership)

| Field | Value |
|-------|-------|
| Identifier | RUN-000 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification (Library Index) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | CONST-PLATFORM-LAWRENCE (Principle 0), AS-003, ADR-0005, ADR-0006, RUN-001 … RUN-011, ASSESS-001 |

> This index defines the **Runtime Architecture Library**: the set of RUN
> specifications that together form the **constitutional runtime contracts** of the
> Processor Runtime (AS-003). It is normative for **canonical object ownership** and the
> producer/consumer graph. The Library is subordinate to the LAWRENCE Platform
> Constitution and its **Principle 0 — The Ontology Owns Reality** (see RUN-011, ADR-0006).
> Terminology follows RFC-2119. No implementation SHALL begin until AS-003 and the RUN
> specifications are ratified and ADR-0005/ADR-0006 are approved.

## Purpose

Establish a single authoritative map of:

- which canonical object each RUN specification **owns**;
- the **authoritative producer** of every object;
- the **authorized consumers** of every object;
- the cross-specification dependency direction.

Each RUN specification's "Canonical Object Contract" section SHALL be consistent with
this index. Where a RUN specification and this index disagree on ownership or producer,
this index governs until corrected by an ADR.

## Library Members

| Spec | Title | Owns (canonical objects) |
|------|-------|--------------------------|
| RUN-001 | Processor Contract | `ProcessorContract`, `ProcessorIdentity`, `ProcessorKind`, `ProcessorAdapter` |
| RUN-002 | Input / Output Contracts | `InputContract`, `InputSetContract`, `OutputContract`, `OutputSetContract`, `ContractValidationResult` |
| RUN-003 | Execution Context | `ProcessorRunContext`, `ProcessorRunId` |
| RUN-004 | Runtime Profiles & Capabilities | `RuntimeProfile`, `RuntimeRequirement`, `RuntimeCapability`, `RuntimeClass` |
| RUN-005 | Incremental Semantics | `IncrementalSemantics`, `IncrementalMode`, `IncrementalKey`, `DeltaSet`, `SnapshotId` |
| RUN-006 | Governance Markings & Clearance | `GovernanceMarking`, `MarkingSet`, `MarkingPropagationRule`, `ClearancePolicy`, `ClearanceDecision`, `ClearanceLevel` |
| RUN-007 | Pipeline Registry | `PipelineRegistry`, `ProcessorPipeline`, `ProcessorPipelineNode` |
| RUN-008 | Output Materializers | `OutputMaterializer`, `MaterializationSink`, `MaterializationResult` |
| RUN-009 | Runtime Exception Taxonomy | `RuntimeException`, `RuntimeFaultKind`, RUN fault subtypes |
| RUN-010 | Conformance Tests | RUN conformance suites & assertions (`/conformance/run/**`) |
| RUN-011 | Ontology & Event Boundary | `ProcessorEffect`, `ProjectionWrite`, `CommandIntent` |

## Canonical Object Ownership Matrix (normative)

| Canonical Object | Owner | Authoritative Producer | Authorized Consumers |
|---|---|---|---|
| `ProcessorContract` | RUN-001 | Processor author (declared); registered via RUN-007 | RUN-007 registry, runtime executor, RUN-008, RUN-010 |
| `ProcessorIdentity` / `ProcessorKind` | RUN-001 | RUN-001 | RUN-007, RUN-009, RUN-010 |
| `InputContract` / `InputSetContract` | RUN-002 | Declared by the owning `ProcessorContract` (RUN-001) | runtime executor (admissibility), RUN-009 |
| `OutputContract` / `OutputSetContract` | RUN-002 | Declared by the owning `ProcessorContract` (RUN-001) | RUN-008 materializer, RUN-010 |
| `ContractValidationResult` | RUN-002 | RUN-002 validator | runtime executor, RUN-008, RUN-009 |
| `ProcessorRunContext` | RUN-003 | Runtime executor at run start (or `fromActorContext` factory) | RUN-001 entry point, RUN-008, observability subscribers |
| `ProcessorRunId` | RUN-003 | RUN-003 | RUN-008, RUN-009, observability/audit |
| `RuntimeProfile` | RUN-004 | RUN-004 matcher (`RuntimeRequirement` × `RuntimeCapability`) | RUN-003 (carries ref), RUN-007 (overrides), RUN-008 (sink selection) |
| `RuntimeRequirement` | RUN-004 | Declared by the owning `ProcessorContract` (RUN-001) | RUN-004 matcher |
| `RuntimeCapability` | RUN-004 | Runtime host (declared) | RUN-004 matcher |
| `IncrementalSemantics` / `IncrementalMode` | RUN-005 | Semantics declared by `ProcessorContract` (RUN-001); mode selected by executor | RUN-002 (keys), RUN-003 (mode), RUN-008 |
| `IncrementalKey` / `DeltaSet` / `SnapshotId` | RUN-005 | RUN-005 (per declared keys) | RUN-002, RUN-008 |
| `GovernanceMarking` / `MarkingSet` | RUN-006 | RUN-006 assignment; propagated by processors per `MarkingPropagationRule` | RUN-002 (carriage), RUN-008 (enforcement), audit |
| `ClearancePolicy` / `ClearanceDecision` | RUN-006 | RUN-006 evaluator (composed with Security `evaluateObjectAccess`) | RUN-003 (context), RUN-008 (enforcement) |
| `PipelineRegistry` | RUN-007 | RUN-007 (process-global singleton) | bootstrap registration (append-only), runtime executor, RUN-010 |
| `ProcessorPipeline` / `ProcessorPipelineNode` | RUN-007 | RUN-007 registration | runtime executor, RUN-008 |
| `OutputMaterializer` / `MaterializationSink` | RUN-008 | RUN-008 | runtime executor |
| `MaterializationResult` | RUN-008 | RUN-008 | lineage, audit, RUN-009 |
| `RuntimeException` / `RuntimeFaultKind` | RUN-009 | RUN-009 normalizer (`normalizeRuntimeFault`) | all RUN specs (raise), executor, RUN-010 |
| `ProcessorEffect` / `ProjectionWrite` / `CommandIntent` | RUN-011 | Processor (declares effect); `CommandIntent` realized by accepted events | RUN-008 (`ProjectionWrite`), Command/Event subsystems (`CommandIntent`) |

## Consumed External Objects (owned outside the Runtime Library)

These objects are **consumed but not owned** by any RUN specification. RUN specs SHALL
treat them as read-only public contracts of their authoritative producers.

| External Object | Authoritative Producer (existing) | RUN Consumer(s) |
|---|---|---|
| **enterprise reality / ontology objects** | **Ontology subsystem** — *owns reality* (Principle 0 §1/§9) | RUN-011 (consumes; never mutates directly) |
| **accepted events** (establish facts) | **Event subsystem / event store** (Principle 0 §5/§8; Axiom 2) | RUN-011 (reality changes realized here) |
| **command acceptance & authorization** | **Command + Policy subsystems** (Principle 0 §6/§7; Axiom 7) | RUN-011 (`CommandIntent`), RUN-006 (authorization composition) |
| `ActorContext` | Platform / app | RUN-003 |
| `AccessDecision`, `SecurityContext`, `evaluateObjectAccess` | Security (`src/lib/security`) | RUN-006 |
| `LineageEvent` / lineage emission | DataOps (`src/lib/dataops/lineage`) | RUN-005, RUN-008 |
| kernel persistence, `requirePermission`, audit hash-chain | `src/lib/lawrence-core` | RUN-008 |
| `executeInference`, `InferenceExecutionContext`, `ExecutionError` | IOS (`src/lib/aiops/execution`) — **read-only, downstream** | RUN-001 (processors that need inference), RUN-009 (wraps `ExecutionError`) |
| `PipelineTransform`, `LawrenceFunction`, `ObjectMapper`, `ParserHandler`, `ActionHandler`, `ImportAdapter` | DataOps / AIOps | RUN-001 adapters |

## Dependency Direction (normative)

```
AS-003
  └─ RUN-000 (this index)
       ├─ RUN-004 ─┐
       ├─ RUN-005 ─┤  (foundational contracts; no intra-library upward deps)
       ├─ RUN-006 ─┤
       ├─ RUN-002 ─┤  (consumes RUN-005 keys, RUN-006 markings)
       ├─ RUN-003 ─┤  (consumes RUN-004 profile, RUN-005 mode, RUN-006 clearance)
       ├─ RUN-001 ─┤  (consumes RUN-002/003/004/005/006)
       ├─ RUN-007 ─┤  (consumes RUN-001/004)
       ├─ RUN-008 ─┤  (consumes RUN-002/003/005/006/011 + external persistence)
       ├─ RUN-009 ─┤  (classifies faults across all; wraps IOS ExecutionError)
       ├─ RUN-011 ─┘  (Principle 0 boundary; consumes Ontology/Event/Command/Policy)
       └─ RUN-010     (verifies all of the above)
```

- Intra-library dependencies SHALL be acyclic and SHALL flow only as shown above.
- No RUN specification SHALL depend on a lower platform layer (Constitution Art. I);
  external objects are consumed only as published public contracts.
- No lower layer (IOS, DataOps, Security, kernel) SHALL depend on any RUN object.
- **Principle 0 (Ontology owns reality).** The Runtime Library owns neither reality nor
  facts. It consumes the Ontology (reality), Event (facts), and Command/Policy (intent/
  authorization) subsystems as published contracts; reality changes occur only via
  accepted events (RUN-011). The Runtime materializes **disposable projections** only.

## Conformance Requirements (index-level)

- **RUN-000/C1.** Every RUN specification's "Objects Owned" SHALL exactly match this
  index; no object SHALL be owned by two specifications.
- **RUN-000/C2.** Every consumed object SHALL name an authoritative producer that exists
  in this index or in the external-objects table.
- **RUN-000/C3.** The intra-library dependency graph SHALL be acyclic (RUN-010 enforces).
- **RUN-000/C4.** No RUN object SHALL claim ownership of enterprise reality or facts; the
  Ontology and Event subsystems remain their authoritative owners (Principle 0; RUN-011).

## Axiom Traceability (normative)

| Axiom | Realized by |
|---|---|
| 1. The ontology owns reality | RUN-011 (no direct mutation), RUN-008 (projections only) |
| 2. Events establish facts | RUN-011 (`CommandIntent` → accepted event) |
| 3. State is derived, never edited | RUN-008 (projections disposable/rebuildable), RUN-005 |
| 4. Contracts define behavior | RUN-001/002 (declared contracts) |
| 5. Invariants define correctness | every RUN spec's Runtime Invariants |
| 6. Specifications precede implementation | AS-003 R11 / DD-001 |
| 7. Governance precedes execution | RUN-011 (policy before effect), RUN-006 |
| 8. Missions express intent | RUN-011 (`CommandIntent`) — bound to mission/command subsystem |
| 9. Automation executes under governance | RUN-006 clearance + RUN-011 authorization |
| 10. Every experience is a projection | RUN-008 (projection materialization) |

## Related Specifications

RUN-001 … RUN-011 (members); governed by AS-003.

## Related ADRs

ADR-0005 (establishing); ADR-0006 (Principle 0 / ontology-event boundary); ADR-0003 and
ADR-0004 (IOS boundary preserved).

## Implementation Notes (non-normative)

- When implemented under `src/lib/runtime/**`, one module SHOULD own each canonical
  object and re-export it; the ownership matrix above maps 1:1 to module ownership.
- The foundational specs (RUN-004/005/006) have no intra-library upward dependency and
  are natural first implementation targets.
