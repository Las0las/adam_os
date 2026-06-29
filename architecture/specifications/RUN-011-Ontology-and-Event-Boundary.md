# RUN-011 — Ontology & Event Boundary

| Field | Value |
|-------|-------|
| Identifier | RUN-011 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification (Constitutional Runtime Contract) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | CONST-PLATFORM-LAWRENCE (Principle 0), AS-003, RUN-000, ADR-0006 |

> Constitutional runtime contract. Normative sections define **what must be true**, not
> how. Implementation guidance appears only under Implementation Notes (non-normative).
> Terminology follows RFC-2119. No implementation until ratified and ADR-0006 approved.

## Purpose

Bind the Processor Runtime to **Principle 0 — The Ontology Owns Reality**. Define the
canonical **`ProcessorEffect`** boundary that separates **projection materialization**
(disposable read models) from **changes to enterprise reality** (which take effect only
via accepted events), so the Runtime owns neither reality nor facts.

## Scope

**In scope:** the `ProcessorEffect` model (`ProjectionWrite` | `CommandIntent`); the
prohibition on direct ontology mutation; governance-precedes-execution; the
non-authoritative, rebuildable nature of projections produced by the Runtime.

**Out of scope (Non-Goals):** defining the Ontology, Command, Policy, or Event subsystems
themselves (owned outside the Runtime Library); event-sourcing storage; altering existing
direct-write callers (e.g. existing `object-service` consumers remain as they are).

## Canonical Object Contract

### Objects Owned
- `ProcessorEffect` — the declared world-effect of a processor run.
- `ProjectionWrite` — an effect targeting a disposable projection (read model).
- `CommandIntent` — an effect expressing intent to change reality, realized only by an
  accepted event.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| Ontology objects / enterprise reality | **Ontology** subsystem (owns reality; external) |
| accepted events (establish facts) | **Event** subsystem / event store (external) |
| command acceptance & authorization | **Command** + **Policy** subsystems (external) |
| `ProcessorRunContext` | RUN-003 |
| `OutputContract` | RUN-002 |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `ProcessorEffect` (`ProjectionWrite`) | RUN-008 `OutputMaterializer` (projection sink) |
| `ProcessorEffect` (`CommandIntent`) | Command subsystem (intent), realized by Event subsystem |

## Normative Interfaces

- **RUN-011/1.** A processor's effect on the world SHALL be expressed as a
  `ProcessorEffect` that is exactly one of `ProjectionWrite` or `CommandIntent`.
- **RUN-011/2.** A `ProjectionWrite` SHALL target a **disposable** projection only; it
  SHALL NOT assert business truth.
- **RUN-011/3.** A `CommandIntent` SHALL express intent and SHALL be submitted to the
  Command subsystem; it SHALL take effect **only** when realized by an **accepted event**
  through the Event subsystem.
- **RUN-011/4.** Authorization for a `CommandIntent` SHALL be determined by the Policy
  subsystem **before** any effect (governance precedes execution); the Runtime SHALL NOT
  self-authorize a reality change.

## Runtime Invariants

- **INV-011.1 (Ontology owns reality).** A processor SHALL NOT mutate ontology objects
  directly (Principle 0 §9; Axiom 1).
- **INV-011.2 (Events establish facts).** Enterprise reality SHALL change only via accepted
  events; a `CommandIntent` that is not accepted SHALL produce no change (Principle 0 §5;
  Axiom 2).
- **INV-011.3 (State is derived).** Projections produced by the Runtime SHALL be
  disposable, rebuildable from the ontology, and SHALL NOT be authoritative (Axiom 3).
- **INV-011.4 (Governance precedes execution).** No `ProcessorEffect` that changes reality
  SHALL occur before Policy authorization (Axiom 7).
- **INV-011.5 (No responsibility capture).** The Runtime SHALL NOT assume the Ontology,
  Event, Command, or Policy subsystem's responsibilities; it interacts only through their
  published contracts (Principle 0 §10/§11).
- **INV-011.6 (Traceability).** Every `ProcessorEffect` SHALL be traceable to a published
  contract (Principle 0 §12; Art. VII).

## Conformance Requirements

- **RUN-011/C1.** No processor performs a direct ontology mutation (static + runtime
  assertion).
- **RUN-011/C2.** Every reality-changing effect is a `CommandIntent` realized by an
  accepted event; an unaccepted command yields no state change.
- **RUN-011/C3.** A `ProjectionWrite` target is rebuildable from the ontology and is not
  treated as authoritative.
- **RUN-011/C4.** A reality-changing effect cannot proceed without Policy authorization.

## Related Specifications

RUN-000 (ownership), RUN-001 (effects of a processor), RUN-002 (output), RUN-003
(context), RUN-008 (consumes `ProjectionWrite`); consumes external Ontology / Event /
Command / Policy contracts.

## Related ADRs

ADR-0006 (establishing the boundary); ADR-0005 (Runtime subsystem).

## Implementation Notes (non-normative)

- The Ontology/Command/Policy/Event subsystems are not yet specified in-repo; until they
  are (e.g. a future `AS-002 Enterprise Ontology` + ONT/EVT specs), RUN-011 binds to them
  as named published contracts. Existing idempotent `object-service` upserts remain valid
  for **existing** callers; new Runtime reality-changes SHOULD route through `CommandIntent`.
- Likely surface: `type ProcessorEffect = ProjectionWrite | CommandIntent`.
