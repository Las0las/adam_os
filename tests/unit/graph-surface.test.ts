// VS-006 — Graph Integrity Review Surface presenter. Pure view-model tests across
// the render states the UI shows: pass (empty), warning, failed, and grouped
// findings. Deterministic; traceable to VS-005 GRAPH_* codes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraphIntegritySurface, governanceStateOf } from "@/lib/dataops/ontology/graph/graph-surface";
import type { GraphIntegrityReport, GraphFinding } from "@/lib/dataops/ontology/graph/graph-types";

function report(partial: Partial<GraphIntegrityReport>): GraphIntegrityReport {
  return {
    valid: true,
    errors: [],
    warnings: [],
    orphanObjects: [],
    duplicateEdges: [],
    invalidPaths: [],
    cycles: [],
    statistics: { objects: 0, edges: 0, disconnectedSubgraphs: 0, orphanCount: 0, validationTimeMs: 1 },
    ...partial,
  };
}
const err = (code: GraphFinding["code"], extra: Partial<GraphFinding> = {}): GraphFinding => ({
  code, severity: "error", message: `${code} message`, ...extra,
});
const warn = (code: GraphFinding["code"], extra: Partial<GraphFinding> = {}): GraphFinding => ({
  code, severity: "warning", message: `${code} message`, ...extra,
});

test("pass state: empty/valid report", () => {
  const s = buildGraphIntegritySurface(report({ valid: true, statistics: { objects: 5, edges: 4, disconnectedSubgraphs: 1, orphanCount: 0, validationTimeMs: 2 } }), "warn");
  assert.equal(s.summary.governanceState, "pass");
  assert.equal(s.summary.totalFindings, 0);
  assert.equal(s.summary.wouldRejectInEnforce, false);
  assert.equal(s.summary.objects, 5);
  assert.equal(s.groups.byCode.length, 0);
});

test("warning state: warnings present, still valid", () => {
  const r = report({ valid: true, warnings: [warn("GRAPH_CARDINALITY", { objectId: "o1", linkType: "targets" })] });
  const s = buildGraphIntegritySurface(r, "warn");
  assert.equal(s.summary.governanceState, "warning");
  assert.equal(s.summary.warningFindings, 1);
  assert.equal(s.summary.blockingFindings, 0);
  assert.equal(s.summary.wouldRejectInEnforce, false);
});

test("failed state: error findings present", () => {
  const r = report({
    valid: false,
    errors: [
      err("GRAPH_ORPHAN", { objectId: "o1", objectType: "Artifact" }),
      err("GRAPH_REQUIRED_RELATIONSHIP", { objectId: "o2", objectType: "Candidate", linkType: "has_resume" }),
    ],
    orphanObjects: ["o1"],
    cycles: [["a", "b", "a"]],
    duplicateEdges: ["submitted:c1->s1"],
  });
  const s = buildGraphIntegritySurface(r, "enforce");
  assert.equal(s.summary.governanceState, "failed");
  assert.equal(s.summary.blockingFindings, 2);
  assert.equal(s.summary.wouldRejectInEnforce, true);
  assert.equal(s.summary.orphanCount, 1);
  assert.equal(s.summary.cycleCount, 1);
  assert.equal(s.summary.duplicateEdgeCount, 1);
  assert.equal(s.summary.missingCriticalRelationships, 1);
  assert.equal(s.summary.affectedNodes, 2);
  assert.equal(s.summary.resolvedMode, "enforce");
});

test("grouped findings: by severity, code, object, relationship, rule", () => {
  const r = report({
    valid: false,
    errors: [
      err("GRAPH_REQUIRED_RELATIONSHIP", { objectId: "c1", linkType: "has_resume" }),
      err("GRAPH_REQUIRED_RELATIONSHIP", { objectId: "c2", linkType: "has_resume" }),
    ],
    warnings: [warn("GRAPH_CARDINALITY", { objectId: "c1", linkType: "targets" })],
  });
  const s = buildGraphIntegritySurface(r, "warn");

  // by severity → error + warning buckets
  assert.deepEqual(s.groups.bySeverity.map((g) => g.key).sort(), ["error", "warning"]);
  // by code → two codes
  assert.deepEqual(s.groups.byCode.map((g) => g.key).sort(), ["GRAPH_CARDINALITY", "GRAPH_REQUIRED_RELATIONSHIP"]);
  // the required-relationship group has 2 findings, both errors
  const reqGroup = s.groups.byCode.find((g) => g.key === "GRAPH_REQUIRED_RELATIONSHIP")!;
  assert.equal(reqGroup.count, 2);
  assert.equal(reqGroup.errors, 2);
  // by object → c1 appears in 2 findings, c2 in 1
  const c1 = s.groups.byObject.find((g) => g.key === "c1")!;
  assert.equal(c1.count, 2);
  // by relationship (linkType)
  assert.deepEqual(s.groups.byRelationship.map((g) => g.key).sort(), ["has_resume", "targets"]);
  // by rule (code:linkType)
  assert.ok(s.groups.byRule.some((g) => g.key === "GRAPH_REQUIRED_RELATIONSHIP:has_resume"));
});

test("governanceStateOf precedence: errors > warnings > pass", () => {
  assert.equal(governanceStateOf(report({ valid: false, errors: [err("GRAPH_CYCLE")] })), "failed");
  assert.equal(governanceStateOf(report({ valid: true, warnings: [warn("GRAPH_CARDINALITY")] })), "warning");
  assert.equal(governanceStateOf(report({ valid: true })), "pass");
});

test("presenter is deterministic", () => {
  const r = report({ valid: false, errors: [err("GRAPH_ORPHAN", { objectId: "o1" })], orphanObjects: ["o1"] });
  assert.deepEqual(buildGraphIntegritySurface(r, "warn"), buildGraphIntegritySurface(r, "warn"));
});
