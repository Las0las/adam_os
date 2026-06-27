# Ontology Governance — Conformance Matrix

| Field | Value |
|-------|-------|
| Status | Active |
| Owner | LAWRENCE Architecture Council |
| Date | 2026-06-27 |
| Scope | Canonical ontology governance: objects, relationships, enterprise graph |

> Maps each ontology governance capability to its standard/spec, ADR, enforcement
> control, and conformance suites. All three layers share the same posture: warn
> by default, opt-in fail-closed enforce mode (tenant → global → env → default).

## Governance layers

| Layer | Question answered | Standard / Spec | ADR(s) | Enforcement env | Typed error |
|-------|-------------------|-----------------|--------|-----------------|-------------|
| Canonical Objects | "Is this object valid?" | ONT-001 | ADR-0006 | `ONTOLOGY_SCHEMA_ENFORCEMENT` | `OntologySchemaError` |
| Canonical Relationships | "Is this relationship valid?" | AS-005 / ONT-002 | ADR-0007, ADR-0008 | `ONTOLOGY_RELATIONSHIP_ENFORCEMENT` | `RelationshipSchemaError` |
| Enterprise Graph | "Is this enterprise graph valid?" | ONT-002 + ADR-0009 | ADR-0009 | `ONTOLOGY_GRAPH_ENFORCEMENT` | `GraphIntegrityError` |

## Enforcement semantics (identical across layers)

- **Default `warn`** — emit a governance event, never block. Existing behavior
  unchanged unless explicitly opted in.
- **`enforce`** — fail closed (reject/throw before persistence; the graph engine
  throws on an invalid graph). Resolution precedence: per-tenant → global → env →
  default.
- **Unregistered** entities are unaffected by enforcement (objects/relationships);
  the graph engine only applies rules to object types that have rules and exist.

## Conformance suites

| Capability | Suite(s) |
|------------|----------|
| Object schema registry + warn-only | `tests/unit/ontology-schema-registry.test.ts`, `tests/unit/upsert-warn-only.test.ts` |
| Object zero warn-baseline | `tests/unit/ont-001-warn-baseline.test.ts` |
| Object enforce-mode | `tests/unit/ont-001-enforcement.test.ts` |
| Relationship registry conformance | `tests/unit/ont-002-relationship-registry.test.ts` |
| Relationship validation + warn baseline | `tests/unit/ont-002-relationship-validation.test.ts` |
| Relationship enforce-mode | `tests/unit/ont-002-relationship-enforcement.test.ts` |
| ONT spec governance | `tests/unit/ont-spec-governance.test.ts` |
| Graph integrity validators (all categories) | `tests/unit/graph-integrity.test.ts` |
| Graph enforce-mode / events / metrics | `tests/unit/graph-enforcement.test.ts` |
| Graph review surface presenter (VS-006) | `tests/unit/graph-surface.test.ts` |
| Graph review surface service + route (VS-006) | `tests/integration/graph-integrity-surface.test.ts`, `tests/integration/graph-integrity-route.test.ts` |
| Mission/workflow graph preflight (VS-007) | `tests/integration/graph-preflight.test.ts` |
| Enterprise governance orchestrator (VS-008) | `tests/integration/governance-orchestrator.test.ts` |

## Graph integrity validation categories

| Category | Code |
|----------|------|
| Required relationships | `GRAPH_REQUIRED_RELATIONSHIP` |
| Cardinality / multiplicity | `GRAPH_CARDINALITY` |
| Orphans | `GRAPH_ORPHAN` |
| Duplicate canonical edges | `GRAPH_DUPLICATE_EDGE` |
| Illegal shortcut paths | `GRAPH_INVALID_PATH` |
| Cycles | `GRAPH_CYCLE` |
| Reachability | `GRAPH_UNREACHABLE` |
| Policy preconditions | `GRAPH_POLICY` |
| Generic constraint (reserved) | `GRAPH_CONSTRAINT` |

## Governance events

- Objects: `ontology.schema.warning` / `ontology.schema.rejected`
- Relationships: `ontology.relationship.warning` / `ontology.relationship.rejected`
- Graph: `ontology.graph.validated` / `warning` / `rejected` / `policy_failed` /
  `cycle_detected` / `orphan_detected`
