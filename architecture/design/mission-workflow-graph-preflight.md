# Design Note — Mission / Workflow Graph Preflight (VS-007)

| Field | Value |
|-------|-------|
| Status | Implemented (on-demand, warn-default) — VS-007 |
| Owner | LAWRENCE Architecture Council |
| Date | 2026-06-27 |
| Consumes | VS-005 `validateGraph()` (ADR-0009) |
| Related | ONT-001 (ADR-0006), ONT-002 (AS-005 / ADR-0008), ADR-0009, VS-006 review surface, conformance-matrix.md |

> VS-007 is the **machine-facing** gate that consumes the graph integrity engine
> before a mission/workflow executes. It does **not** wire graph validation into
> object/relationship writes, and it changes no existing mission/workflow behavior
> unless explicitly called.

## The three layers — one engine, three consumers

| Layer | Facing | What it is | When it runs |
|-------|--------|-----------|--------------|
| **VS-005** Graph Integrity Engine (ADR-0009) | — | The deterministic engine: `validateGraph()` → `GraphIntegrityReport` (required relationships, cardinality, orphans, cycles, duplicate edges, illegal paths, reachability, policy). | on-demand, called by consumers |
| **VS-006** Review Surface | **Human** | Read-only UI that renders the report (Pass/Warning/Failed, metrics, grouped findings) so operators can review integrity. | operator clicks "Run" |
| **VS-007** Preflight Gate | **Machine** | A typed decision over the report: advisory in warn mode, blocking in enforce mode, for a mission/workflow about to execute. | a mission/workflow calls it before executing |

VS-006 and VS-007 are siblings over the same engine and the same `GRAPH_*` codes:
the surface lets a human *see* the integrity that the preflight will *assert*. Both
are on-demand; neither touches the write path.

## Contract

`preflightGraph(ctx, { subjectType, subjectId, objectTypes?, graph?, rules?, config?, mode? }) → GraphPreflightResult`

```
GraphPreflightResult {
  status: "pass" | "warning" | "blocked"
  mode: "warn" | "enforce"
  subjectType, subjectId
  findings, blockingFindings, warningFindings      // GRAPH_* codes preserved
  affectedObjects[], affectedRelationships[]
  recommendedHumanAction: string | null            // deterministic, code-derived
  audit: { event, subjectType, subjectId, tenantId, codes[] }
}
```

## Decision semantics

The preflight always validates **internally in warn mode** (so the engine never
throws inside it) and then owns the block decision from the resolved mode:

| Graph | warn mode | enforce mode |
|-------|-----------|--------------|
| clean | `pass` | `pass` |
| warnings only | `warning` | `warning` |
| blocking (error) findings | `warning` (advisory — never blocks) | **`blocked`** → throws `MissionPreflightError` / `WorkflowPreflightError` |

The thrown error carries the full `GraphPreflightResult`. Enforce blocks **only**
on blocking (error-severity) findings; warning-only graphs proceed in both modes.

## Integration posture

VS-007 is **exposed, not force-wired**. Mission/workflow execution paths MAY call
`preflightGraph()` at their existing service boundary before executing; this slice
adds no such call (so existing behavior and tests are unchanged). Wiring a specific
mission/workflow runtime to gate on the preflight is a follow-up that touches only
that boundary.

## Guarantees

- **Deterministic** — pure function of `(graph, rules, config, mode)`; outputs sorted.
- **Traceable** — every finding keeps its VS-005 `GRAPH_*` code.
- **No business logic here** — rules live in the graph rule registry only.
- **No auto-fix, no AI/heuristics.**
- **Warn-default / opt-in enforce** — mirrors ADR-0006/0008/0009.

## Events & metrics

Events: `ontology.graph.preflight.passed` / `.warning` / `.blocked` (with
subjectType/subjectId/codes). Metrics: preflightsRun / passed / warned / blocked.
(The underlying `validateGraph()` also emits its own graph events — two layers,
both audited.)

## Migration implications

**None.** One additive service file + tests + docs. No schema, table, data,
write-path, or existing-execution change.
