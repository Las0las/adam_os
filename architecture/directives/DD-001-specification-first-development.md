# DD-001 — Specification-First Development

| Field | Value |
|-------|-------|
| Identifier | DD-001 |
| Version | 1.0 |
| Status | Active |
| Authority | Development Directive |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Derived From | LAWRENCE Constitution v1.0, AS-001 Inference Operating System |
| Related Artifacts | ADR-0002, architecture-v1.0 freeze declaration |

> A **Development Directive** governs *how* day-to-day development proceeds, where
> the Constitution governs *what* governs the platform. DD-001 is a permanent
> governance artifact and derives authority from the Constitution and AS-001.
> Terminology follows RFC-2119 (SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY).

## Purpose

Effective immediately, LAWRENCE adopts **Specification-First Development** as the
mandatory implementation workflow.

- Implementation SHALL originate from approved specifications.
- Architecture SHALL NOT be created or modified during implementation unless
  explicitly authorized through the Architecture Governance Process (an approved
  ADR, and an Architecture Standard revision or Constitutional Amendment where
  applicable).
- Milestones are historical implementation records; **specifications are the
  authoritative development work items**.

## Development Workflow

All new implementation requests SHALL follow the sequence (no stage bypassed):

```
Constitution → Architecture Standard → Specification → ADR (if required) →
Public Contract → Implementation → Conformance → Release
```

Implementation SHALL NOT begin from an idea or a milestone alone.

## Request Format

Every implementation request SHALL begin with a specification reference.

**Correct**
- "Implement **IOS-008 Batch Scheduler** according to **AS-001 Inference
  Operating System**."
- "Implement **IOS-009 Semantic Cache** according to **AS-001**, preserving
  conformance with IOS-004 (Execution Pipeline) and IOS-007 (Cache Platform)."
- "Implement **ONT-003 Canonical Object Lifecycle** according to **AS-002
  Enterprise Ontology**."

**Incorrect** (lack governing authority; SHALL first be expressed as a
specification or ADR)
- "Build the Batch Scheduler." · "Add Semantic Cache." · "Improve the Pipeline."
  · "Redesign Routing." · "Add another architecture layer."

## Required Request Structure

Every implementation request SHALL include:

1. **Specification Identifier** — e.g. `IOS-008`.
2. **Architecture Standard** — e.g. `AS-001 Inference Operating System`.
3. **Objective** — e.g. "Deterministic request batching for compatible inference
   workloads."
4. **Conformance Requirements** — specifications whose conformance SHALL be
   preserved (e.g. IOS-004, IOS-005, IOS-007).
5. **Explicitly Out of Scope** — what SHALL NOT be modified (e.g. Routing,
   Provider Registry, Security Middleware).
6. **Success Criteria** — implementation SHALL satisfy the published specification
   without architectural drift.

## Architecture Decision Rules

If implementation requires changing Architecture, Standards, Public Contracts, or
Constitutional Invariants, implementation SHALL STOP. An ADR SHALL be produced and
approved before implementation continues. **Code SHALL NOT redesign architecture.**

## Claude Code Responsibilities

On receiving an implementation request, Claude Code SHALL:

1. Locate the referenced specification.
2. Verify the governing Architecture Standard.
3. Identify dependent specifications.
4. Preserve conformance with existing contracts.
5. Implement only the requested specification.
6. Avoid architectural redesign unless an approved ADR explicitly requires it.
7. Validate the implementation through the appropriate conformance tests.

If no specification exists, Claude Code SHALL recommend creating one (a
specification, and an ADR if architecture is affected) **before** implementation
begins.

## Milestone Policy

Milestones remain useful as historical delivery records (e.g. Milestone 7.0 →
IOS-007 Cache Platform; Milestone 8.0 → Constitutional Governance Framework).
Future planning SHALL reference **specification identifiers**, not milestone
numbers.

## Naming Convention

| Artifact | Prefix | Examples |
|----------|--------|----------|
| Architecture Standards | `AS-NNN` | AS-001, AS-002, AS-003 |
| Specifications | `<DOMAIN>-NNN` | IOS-001, ONT-001, MIS-001, SDK-001, RUN-001 |
| Public Contracts | `CON-NNN` | CON-001, CON-002 |
| Architecture Decisions | `ADR-NNNN` | ADR-0001, ADR-0002 |
| Development Directives | `DD-NNN` | DD-001 |
| Conformance Suites | `CONF-<DOMAIN>` | CONF-IOS, CONF-ONT, CONF-MIS |

## Constitutional Directive

The LAWRENCE platform is governed by specifications rather than milestone prompts.
The architecture is stable; specifications evolve; implementations realize
specifications; conformance validates implementations. Future development SHALL
begin with a specification reference and SHALL preserve constitutional authority,
architectural integrity, and conformance with published standards.
