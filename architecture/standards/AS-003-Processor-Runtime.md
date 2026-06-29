# AS-003 — Processor Runtime Architecture Standard

| Field | Value |
|-------|-------|
| Identifier | AS-003 |
| Version | 0.1 |
| Status | Draft |
| Authority | Architecture Standard |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Derived From | LAWRENCE Platform Constitution v1.0 (Principle 0); LAWRENCE Constitution v1.0 (IOS) |
| Related Artifacts | CONST-PLATFORM-LAWRENCE, AS-001, ADR-0005, ADR-0006, RUN-000 … RUN-011, ASSESS-001 |
| Superseded By | — |

> An Architecture Standard sits between the Constitution and Normative
> Specifications. It SHALL refine constitutional principles into binding rules for
> a coherent subsystem, and SHALL itself derive authority from the Constitution.
> Terminology follows RFC-2119 (SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY).
>
> **This is a DRAFT skeleton.** It defines the subsystem boundary and binding rules
> at the architectural level only. It does NOT define implementation, and no
> implementation SHALL begin until this Standard and its specifications are
> ratified and an establishing ADR (ADR-0005) is approved.

## 1. Purpose

AS-003 establishes the **Processor Runtime (RUN)**: the governed subsystem through
which **declared, contract-bound units of data and computation work** ("processors")
are described, registered, executed, materialized, and governed across heterogeneous
runtimes (lightweight, distributed, GPU, serverless, automation, human-review).

The Processor Runtime is the LAWRENCE realization of Palantir-style transform
contracts: each processor declares its input contracts, output contracts, runtime
requirements, incremental semantics, and governance markings, and is executed under a
governed runtime profile that preserves auditability and tenant isolation.

AS-003 places the Processor Runtime **beneath** the Constitution and **above** the RUN
Normative Specifications (RUN-001 … RUN-010).

## 2. Scope

This Standard governs:

1. The Processor Contract and processor identity model (RUN-001).
2. Input / Output (and Set) Contracts (RUN-002).
3. The `ProcessorRunContext` execution-context model (RUN-003).
4. Runtime Profiles, `RuntimeCapability`, and `RuntimeRequirement` (RUN-004).
5. Incremental Semantics — full / incremental / snapshot / delta (RUN-005).
6. Governance Markings and Clearance evaluation (RUN-006).
7. The Pipeline Registry (RUN-007).
8. Output Materializers and materialization sinks (RUN-008).
9. The Runtime Exception taxonomy (RUN-009).
10. Conformance requirements and suites for the above (RUN-010).
11. The Ontology & Event boundary binding the Runtime to Principle 0 (RUN-011).

### 2.1 Out of Scope (Non-Goals)

AS-003 SHALL NOT govern, alter, or redefine:

- The Inference Operating System (AS-001) or any IOS specification (IOS-001 … IOS-013).
- The IOS Execution Pipeline (IOS-004), its `ExecutionHook` contract, or `aroundInvoke`.
- Provider selection, routing, or the Execution Plan (IOS-003 / ADR-0004).
- Any module under `aiops/execution/**`.
- Persistence engines, UI, or domain/experience modules.

The Processor Runtime is a **consumer** of the IOS, not an extension of it. Where a
processor needs model inference, it SHALL obtain it by calling the **published IOS
public contract** (`executeInference`) as an ordinary downstream caller — never by
adding, wrapping, or modifying an IOS execution seam.

## 3. Binding Rules

- **R0 (Subordinate to Principle 0).** The Processor Runtime SHALL be subordinate to the
  LAWRENCE Platform Constitution and its **Principle 0 — The Ontology Owns Reality** and
  ten Architectural Axioms. The Runtime owns **neither reality nor facts**: it SHALL NOT
  mutate ontology objects directly; reality changes SHALL be expressed as commands
  (intent) realized only by accepted events; only disposable projections may be
  materialized directly. Governance (policy/authorization) SHALL precede execution. The
  Ontology/Event boundary is specified by RUN-011. (Principle 0 §5/§9; Axioms 1–3, 7.)
- **R1 (Sibling, not extension).** The Processor Runtime SHALL be a sibling subsystem
  governed by this Standard. It SHALL NOT introduce, modify, or depend on any IOS
  execution extension point. It SHALL NOT modify AS-001, IOS-004, or `aiops/execution/**`.
- **R2 (Additive only).** Every RUN artifact SHALL be additive. It SHALL NOT rename,
  move, delete, or weaken any existing public contract, type, or test. New behavior
  SHALL be opt-in: a processor that is not registered or wrapped SHALL NOT change any
  existing runtime behavior.
- **R3 (Declared contracts).** A processor's inputs, outputs, runtime requirements,
  incremental semantics, and governance markings SHALL be **declared**, never inferred
  from names, file paths, or provider identity.
- **R4 (Authority direction).** The Processor Runtime is a **higher** layer than the
  IOS, DataOps primitives, Security, and the kernel. Per Constitution Art. I, lower
  layers SHALL NOT depend on the Processor Runtime. The kernel (`lawrence-core/**`)
  SHALL NOT import Processor Runtime modules, except the sanctioned additive
  registration aggregation point, and only by appending side-effect registration
  imports.
- **R5 (Single inference path preserved).** Inference SHALL continue to flow solely
  through the IOS Execution Pipeline. The Processor Runtime SHALL NOT become a second
  provider-invocation path and SHALL NOT invoke a provider directly.
- **R6 (Governed materialization).** All persistence performed by an Output Materializer
  SHALL route through existing kernel persistence, permission guards, tenant scoping,
  and audit emission. A materializer SHALL NOT write directly to a store, bypass an
  access decision, or weaken an existing deny. Per R0, a materializer SHALL write only
  **disposable projections** (`ProjectionWrite`, RUN-011); it SHALL NOT mutate enterprise
  reality — reality changes are `CommandIntent` realized by accepted events.
- **R7 (Governance composition).** Clearance evaluation SHALL **compose with**, and
  SHALL NOT replace or relax, the existing Security access decision. A governance
  marking SHALL only ever further restrict access; it SHALL NOT broaden it.
- **R8 (Determinism & observation safety).** Processor execution SHALL be deterministic
  given identical inputs, contracts, and profile. Observation of a processor run SHALL
  NOT alter its outcome, mutate its inputs/outputs, or turn success into failure.
- **R9 (Immutability).** `ProcessorRunContext`, resolved contracts, runtime profiles,
  marking sets, and materialization results SHALL be immutable once produced.
- **R10 (Naming discipline).** RUN artifacts SHALL NOT export the bare identifiers
  `ExecutionContext`, `Capability`, `Classification`, `Policy`, `Processor`, `Function`,
  or `Pipeline`. The canonical names are `ProcessorRunContext`, `RuntimeCapability` /
  `RuntimeRequirement`, `GovernanceMarking`, and qualified `*Policy` names
  (e.g. `ClearancePolicy`). `Classification` (data sensitivity, Security) and
  `Clearance` (access entitlement, RUN) SHALL remain distinct concepts.
- **R11 (Specification-First).** Each RUN subsystem SHALL be defined by a versioned
  Normative Specification before implementation. Implementations SHALL derive authority
  only through the Constitution and this Standard (DD-001).

## 4. Governed Specifications

| Specification | Subsystem |
|---------------|-----------|
| RUN-000 | Runtime Architecture Library (index & ownership matrix) |
| RUN-001 | Processor Contract |
| RUN-002 | Input / Output Contracts |
| RUN-003 | Execution Context (`ProcessorRunContext`) |
| RUN-004 | Runtime Profiles and Capabilities |
| RUN-005 | Incremental Semantics |
| RUN-006 | Governance Markings and Clearance |
| RUN-007 | Pipeline Registry |
| RUN-008 | Output Materializers |
| RUN-009 | Runtime Exception Taxonomy |
| RUN-010 | Conformance Tests |
| RUN-011 | Ontology & Event Boundary (Principle 0 binding) |

## 5. Dependency Direction

```
Constitution
  └─ AS-003 Processor Runtime  (this Standard)
       └─ RUN-001 … RUN-010 (specifications)
            └─ Public Contracts
                 └─ Implementations (src/lib/runtime/**)  — future, governed
```

Allowed implementation import direction (when implemented):

```
src/lib/runtime/**  ──▶ aiops public contracts (executeInference, event bus)   [consume only]
                    ──▶ dataops public contracts (transforms, registries, lineage)
                    ──▶ security public contracts (classification, access-guard)
                    ──▶ lawrence-core (db, audit, permissions, ids)             [kernel]
```

Forbidden: any import from `aiops/**`, `dataops/**`, `security/**`, `lawrence-core/**`,
`domains/**`, or `app/**` **into** `src/lib/runtime/**`'s upstream — i.e. lower layers
SHALL NOT reference the Processor Runtime.

## 6. Compatibility with AS-001 / IOS

- **Art. III/IV/V preserved:** provider independence, single inference path, and
  governed capability attachment are unaffected — the Processor Runtime never reroutes,
  retries, optimizes, or mutates provider behavior.
- **ADR-0003 preserved:** no new IOS execution extension point is introduced; the IOS
  execution-extension architecture remains complete and untouched.
- **ADR-0004 preserved:** routing/Execution Plan ownership is unchanged.
- **Byte-for-byte equivalence:** with no processor registered or wrapped, all existing
  behavior and tests SHALL be unchanged. RUN-010 SHALL require an additive-equivalence
  proof analogous to the `aroundInvoke` equivalence proof.

## 7. Conformance

Each governed RUN Specification SHALL declare Conformance Requirements and SHALL
eventually be backed by an executable conformance suite under `/conformance/run/<area>`
(RUN-010). Existing `tests/**` and `/conformance/ios/**` SHALL NOT be moved or changed.

## 8. Open Questions

- **OQ-1.** Final Architecture Standard number: AS-003 is proposed to avoid the
  AS-002 slot informally reserved by DD-001 for Enterprise Ontology. Council to confirm.
- **OQ-2.** Whether the Processor Runtime implementation root is `src/lib/runtime/` or
  `src/lib/processor-runtime/` (RUN-001 to fix once approved).
- **OQ-3.** Whether RUN should depend on a future Enterprise Ontology Standard (AS-002)
  for ontology-typed outputs, or remain ontology-agnostic at the contract layer.
- **OQ-4.** Relationship between RUN incremental semantics and the existing idempotent
  ontology upsert/ledger — alignment vs. a distinct delta substrate (RUN-005).

## 9. Authority

AS-003 derives all authority from the LAWRENCE Constitution v1.0. AS-003 SHALL NOT
contradict the Constitution or AS-001. Amendments SHALL be recorded as ADRs.
