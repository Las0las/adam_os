# Design Note — Graph Integrity Review Surface (VS-006)

| Field | Value |
|-------|-------|
| Status | Implemented (read-only, user-triggered) — VS-006 |
| Owner | LAWRENCE Architecture Council |
| Date | 2026-06-27 |
| Consumes | VS-005 `validateGraph()` (ADR-0009) |
| Related | ONT-001 (ADR-0006), ONT-002 (AS-005 / ADR-0008), ADR-0009, conformance-matrix.md |

> VS-006 makes graph integrity **visible, reviewable, and actionable** without
> changing write behavior. It is a read-only governance surface over the existing
> on-demand VS-005 engine — no auto-fix, no AI, no write-path coupling.

## Where VS-006 sits in the validation stack

| Layer | Question | When it runs | VS-006 relationship |
|-------|----------|--------------|---------------------|
| **ONT-001** object validation (ADR-0006) | Is this *object* valid? | per `upsertObject` (warn/enforce) | Surfaced indirectly: object findings shape the graph the surface validates |
| **ONT-002** relationship validation (ADR-0008) | Is this *relationship* valid? | per `linkObjects` (warn/enforce) | Surfaced indirectly: edges the surface analyses are the ones relationship validation governs |
| **ADR-0009** graph integrity (VS-005) | Is this *graph* valid? | on-demand `validateGraph()` | **VS-006 is the human surface for this layer** |
| **VS-006** review surface | How do operators *see and review* graph integrity? | user clicks "Run Graph Validation" | this note |

VS-006 does not re-validate objects or relationships itself — it composes the
VS-005 report (which already reflects required relationships, cardinality, orphans,
cycles, duplicate edges, illegal paths, reachability, and policy) into an
executive-grade, operationally-useful view-model.

## Architecture

```
src/lib/dataops/ontology/graph/
  graph-surface.ts          # PURE presenter: report -> GraphIntegritySurface (states + groups + summary)
  graph-surface-service.ts  # server: load tenant graph (optional scope) -> validateGraph(warn) -> presenter
app/api/ontology/graph-integrity/validate/route.ts   # POST (read-only, user-triggered)
app/(lawrence)/mission-control/graph-integrity/page.tsx   # read-only page
src/components/lawrence/graph-integrity/GraphIntegrityView.tsx   # client: run + render
```

- **Always warn-mode review.** The service calls `validateGraph(ctx, { mode: "warn" })`
  so the review can never throw. The presenter computes the governance state
  (`pass` / `warning` / `failed`) from the findings and reports
  `wouldRejectInEnforce` + the tenant's `resolvedMode`, so operators see what
  enforce *would* do — without enabling it.
- **User-triggered only.** Nothing validates on page load or on write. The page
  renders a button; validation happens on click via the API.
- **Deterministic & traceable.** Every displayed finding carries its VS-005
  `GRAPH_*` code; the raw report is included for traceability.

## Governance states

| State | Meaning |
|-------|---------|
| **Pass** | no findings |
| **Warning** | warning-severity findings only (valid graph) |
| **Failed** | one or more error-severity findings (would reject under enforce) |

## Summary metrics surfaced

total findings, blocking findings, warning findings, affected nodes, affected
edges, orphan count, cycle count, duplicate edges, missing critical relationships,
plus graph statistics (objects, edges, disconnected subgraphs, validation time).

## Findings grouping

By severity · by code · by object · by relationship (linkType) · by rule
(`code:linkType`). Each group reports its error/warning counts.

## What VS-006 deliberately does NOT do

- No auto-fix / remediation.
- No wiring of validation into object or relationship writes (write behavior is
  unchanged; VS-006 only *reads*).
- No AI/heuristics — it renders the deterministic VS-005 report verbatim.
- Does not flip enforcement; it only reports the resolved mode.

## Relationship to future mission/workflow preflight checks

VS-006 is the **human-facing** consumer of `validateGraph()`. The same engine is
intended to back **machine-facing preflight gates**: before a mission/workflow
executes, a preflight step calls `validateGraph(ctx, { mode })` and blocks (under
enforce) or annotates (under warn) using the identical report and codes. VS-006
and a future preflight share one engine and one contract — the surface lets
operators review the very integrity a preflight will assert, building trust before
enforcement is turned on. (Preflight wiring is out of scope for VS-006.)

## Migration implications

**None.** New presenter + service + route + page + component + one nav link. No
schema, table, data, or write-path change.
