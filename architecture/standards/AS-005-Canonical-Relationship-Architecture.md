# AS-005 — Canonical Relationship Architecture

| Field | Value |
|-------|-------|
| Identifier | AS-005 |
| Version | 1.0 |
| Status | Active |
| Authority | Architecture Standard |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Derived From | LAWRENCE Constitution v1.0 |
| Related Artifacts | ONT-001 (Canonical Object Model); ONT-002 (Canonical Relationship Model); ADR-0007 |
| Superseded By | — |

> An Architecture Standard sits between the Constitution and Normative
> Specifications. It refines constitutional principles into binding rules for a
> coherent subsystem and derives authority from the Constitution. Terminology
> follows RFC-2119.

## 1. Purpose

AS-005 establishes that **relationships between canonical objects are first-class,
versioned, governed architecture artifacts** — not arbitrary graph edges. Where
ONT-001 governs the canonical *objects* (the nouns), AS-005 governs the canonical
*relationships* (the verbs that connect them). It places the Canonical
Relationship Model beneath the Constitution and above its Normative Specification
(ONT-002).

This satisfies Constitution Article I (single source of truth) and Article VII
(traceability): the legal shape of the object graph must be defined once,
authoritatively, rather than emerging implicitly from whatever `linkType` strings
callers happen to pass.

## 2. Scope

AS-005 governs:

1. The **identity** of a canonical relationship (a stable id + wire `linkType`).
2. Its **directionality** (`sourceType → targetType`) and optional **inverse**.
3. Its **cardinality** contract.
4. Its **lifecycle** as a contract (`active` / `planned` / `deprecated`).
5. Required and optional **metadata** (description, governance, declared events,
   declared permissions, validation hooks).
6. The **registry** that holds these definitions and the **validation** applied to
   relationship instances.

It does NOT govern: object schemas (ONT-001), object/relationship *instance*
lifecycle state machines, UI, or runtime enforcement policy beyond what ONT-002
specifies. AS-005 does not introduce new business object types.

## 3. Binding rules

1. A canonical relationship SHALL be defined exactly once, by ONT-002, as a
   strongly-typed `RelationshipDefinition` — never as a bare string.
2. Every relationship SHALL declare: id, linkType, sourceType, targetType,
   cardinality, lifecycle, description, and governance metadata.
3. Directionality SHALL be explicit; an inverse, when registered, SHALL be mutual
   and SHALL flip the endpoints.
4. Relationship contracts SHALL evolve additively (Constitution Article II);
   changing direction, cardinality, or endpoints of an existing relationship is a
   breaking change requiring an ADR.
5. Validation SHALL be **observational by default** (warn-only): it SHALL NOT
   alter or block edge creation unless a future ADR explicitly enables
   enforcement (mirroring the ONT-001 warn-then-enforce posture).
6. Object types referenced by a `planned` relationship MAY NOT exist yet;
   declaring a relationship SHALL NOT imply implementing its endpoints.

## 4. Relationship to ONT-001

AS-005 is the relationship analogue of the ONT-001 object discipline. The two
compose: ONT-001 fixes what an object *is*; AS-005/ONT-002 fix how objects may be
*connected*. Neither widens the other — ONT-002 references object types by name
and does not modify ONT-001.

## 5. Conformance

A conformant implementation SHALL provide a typed relationship registry and
warn-only validation as specified by ONT-002, with conformance suites proving
registry well-formedness, inverse symmetry, seed coverage, and each validation
class. See ONT-002 §Conformance.
