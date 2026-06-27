# ADR-0006 — Platform Constitution (Principle 0) and the Runtime Ontology/Event Boundary

| Field | Value |
|-------|-------|
| Identifier | ADR-0006 |
| Status | Draft (Proposed) |
| Date | — (Draft) |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | New: CONST-PLATFORM-LAWRENCE, RUN-011. Amended: AS-003, RUN-000, RUN-008, RUN-010, RUN-001 |
| Supersedes | — |
| Superseded By | — |
| Related Artifacts | CONST-LAWRENCE, AS-001, AS-003, ADR-0003, ADR-0005, DD-001 |

## Title

Record the **LAWRENCE Platform Constitution** (with **Principle 0 — The Ontology Owns
Reality** and the ten Architectural Axioms) as the platform-supreme governing artifact,
and **subordinate the Processor Runtime to it** by establishing an explicit
**ontology/event boundary**: a processor SHALL NOT mutate ontology objects directly;
reality changes are expressed as **commands (intent)** realized only by **accepted
events**; only **projections** (disposable read models) may be materialized directly.

## Status

**Draft (Proposed).** Docs only. This ADR establishes the platform constitution artifact
in-repo and the additive amendments that bring the Runtime Architecture Library into
conformance with Principle 0. No runtime implementation is authorized.

## Context

The Processor Runtime (AS-003, RUN-000 … RUN-010) was authored against the in-repo
`CONST-LAWRENCE`, which is **IOS-focused** and does not contain Principle 0, the ontology,
the command/policy/event model, missions, or the ten axioms. The **Platform Constitution
v1.0** supplies those higher principles. Re-reading the Runtime Library against it surfaces
one material conflict and several alignment gaps:

1. **RUN-008 conflates two separated concerns.** As merged, an `OutputMaterializer`
   persists outputs "through kernel persistence + permissions + audit." Principle 0
   distinguishes (a) writing a **projection** (disposable; allowed) from (b) mutating
   **enterprise reality** (which SHALL flow through commands → policies → accepted events;
   "services never mutate ontology objects directly"; "state is derived, never edited").
   RUN-008 as written would permit a processor to directly mutate ontology state if
   audited — a violation of Axioms 1–3 and Principle 0 §5/§9.
2. **No intent/event boundary** (Axioms 2, 8, 9). The Library never states that
   reality-changing output is a **command** realized only by an **accepted event**,
   executed **under governance** (governance precedes execution).
3. **Ontology ownership not represented** in RUN-000's producer set (Principle 0 §1/§3/§4):
   the Ontology (owns reality), the Event store / accepted events (own facts), and
   Command/Policy (intent/authorization) are not named as authoritative producers the
   Runtime defers to.
4. **"No subsystem assumes another's responsibilities"** (Principle 0 §10): RUN-006/008
   lean toward the Runtime assuming the event/ontology subsystem's role.

## Decision

1. **Record the Platform Constitution in-repo** as `CONST-PLATFORM-LAWRENCE`
   (platform-supreme), transcribed faithfully from the provided material, and **relate —
   not supersede —** the existing `CONST-LAWRENCE` (which continues to govern the IOS
   subsystem beneath it).
2. **Subordinate the Processor Runtime to Principle 0** (amend AS-003 with a binding rule:
   the Runtime owns neither reality nor facts).
3. **Establish the ontology/event boundary** (new RUN-011):
   - A processor's effect on the world SHALL be a `ProcessorEffect`, one of:
     - `ProjectionWrite` — writing/refreshing a **disposable** projection (allowed
       directly, governed, audited); or
     - `CommandIntent` — a **command** expressing intent to change reality, which takes
       effect **only** when realized by an **accepted event** through the ontology/event
       subsystem.
   - A processor SHALL NOT mutate ontology objects directly (Principle 0 §9).
   - Governance (policy/authorization) SHALL precede execution (Axiom 7).
   - Projections SHALL be rebuildable from the ontology and SHALL NOT be authoritative
     (Axiom 3, projections principle).
4. **Amend RUN-008** to split projection-materialization from `CommandIntent` emission and
   forbid direct ontology mutation.
5. **Amend RUN-000** to add the Ontology, Event store/accepted events, and Command/Policy
   as authoritative producers in the external-objects table, and to record axiom
   traceability.
6. **Amend RUN-010** with conformance assertions for the boundary; **amend RUN-001** with a
   no-direct-reality-mutation invariant referencing RUN-011.

## Alternatives Considered

- **Leave RUN-008 as-is, rely on existing direct upserts.** Rejected: the existing
  `object-service.upsertObject` direct-write path is preserved for existing callers, but
  the **new** Runtime layer SHALL conform to Principle 0; permitting new direct ontology
  mutation would entrench an Axiom 1–3 violation.
- **Fold the boundary into RUN-008 only.** Rejected: the ontology/event boundary is a
  distinct constitutional concern owned by its own spec (RUN-011); RUN-008 consumes it.
- **Do not commit the Platform Constitution.** Rejected: Principle 0 cannot govern the
  RUN specs by citation if it is absent from the repo; encoding it makes the authority
  chain explicit and traceable (Axiom: traceable to a published contract).

## Consequences

- The Runtime Library becomes Principle-0-conformant: processors produce **intent and
  projections**, never direct reality mutations.
- One new constitution artifact, one new spec (RUN-011), and additive amendments to four
  RUN artifacts + AS-003. No deletions; no existing behavior changed; existing
  `object-service` callers untouched.

## Compatibility Analysis (asserted)

- **Additive.** New artifacts + amendments only; no rename/move/deletion; existing tests
  and code paths unchanged.
- **IOS untouched.** ADR-0003/0004 preserved; `aiops/execution/**` unmodified.
- **Dependency direction preserved.** The Runtime consumes the Ontology/Event/Command
  contracts as published, downstream contracts; lower layers do not depend on the Runtime.

## Conformance Impact

RUN-010 gains assertions: no processor performs a direct ontology mutation; every
reality-changing `ProcessorEffect` is a `CommandIntent` realized by an accepted event;
projections are rebuildable and non-authoritative.

## Open Questions

- The authoritative interfaces of the Command, Policy, and Event subsystems are not yet
  specified in-repo (no ONT/CMD/EVT standard exists). RUN-011 references them as published
  contracts; their specifications SHOULD be authored (e.g. a future `AS-002 Enterprise
  Ontology` + ONT/EVT specs) so RUN-011 can bind concretely.
- Whether `CONST-PLATFORM-LAWRENCE` formally re-files `CONST-LAWRENCE` as a subordinate
  "subsystem charter" or leaves it as a peer-with-scope.

## Approval

— (Draft; not yet approved.)
