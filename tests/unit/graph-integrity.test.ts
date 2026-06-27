// VS-005 Graph Integrity Engine — validator coverage across all categories.
// Deterministic; validates constructed graph snapshots (no DB needed for the
// validators). In-memory DB only backs the governance events.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { validateGraph, resetGraphMetrics } from "@/lib/dataops/ontology/graph/graph-integrity";
import type { GraphRule, OntologyGraph, OntologyObject, OntologyLink } from "@/lib/dataops/ontology/graph/graph-types";

function obj(id: string, objectType: string, status: string | null = null): OntologyObject {
  return { id, tenantId: "t", objectType, externalKey: id, title: id, status, properties: {}, createdAt: "t0", updatedAt: "t0" };
}
function edge(linkType: string, from: OntologyObject, to: OntologyObject): OntologyLink {
  return {
    id: `l_${from.id}_${linkType}_${to.id}`,
    tenantId: "t",
    linkType,
    fromObjectType: from.objectType,
    fromObjectId: from.id,
    toObjectType: to.objectType,
    toObjectId: to.id,
    createdAt: "t0",
  };
}
const ctx = () => systemActor("t");
const WARN = { mode: "warn" as const };
const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code).sort();

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetGraphMetrics();
});

// ── Required relationships ────────────────────────────────────────────────────
const RESUME_RULE: GraphRule[] = [
  { objectType: "Candidate", requiredRelationships: [{ linkType: "has_resume", direction: "out", otherType: "Resume", min: 1 }] },
];

test("required relationships: valid graph has no errors", async () => {
  const c = obj("c1", "Candidate"); const r = obj("r1", "Resume");
  const graph: OntologyGraph = { objects: [c, r], links: [edge("has_resume", c, r)] };
  const report = await validateGraph(ctx(), { graph, rules: RESUME_RULE, ...WARN });
  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
});

test("required relationships: missing required edge errors", async () => {
  const c = obj("c1", "Candidate");
  const report = await validateGraph(ctx(), { graph: { objects: [c], links: [] }, rules: RESUME_RULE, ...WARN });
  assert.deepEqual(codes(report), ["GRAPH_REQUIRED_RELATIONSHIP"]);
});

test("required relationships: multiple missing required edges across objects", async () => {
  const c1 = obj("c1", "Candidate"); const c2 = obj("c2", "Candidate");
  const report = await validateGraph(ctx(), { graph: { objects: [c1, c2], links: [] }, rules: RESUME_RULE, ...WARN });
  assert.equal(report.errors.filter((e) => e.code === "GRAPH_REQUIRED_RELATIONSHIP").length, 2);
});

// ── Cardinality ───────────────────────────────────────────────────────────────
const JOB_CARD: GraphRule[] = [
  { objectType: "Job", cardinality: [{ linkType: "targets", direction: "in", otherType: "Submission", min: 1, max: 2 }] },
];

test("cardinality: under minimum errors", async () => {
  const j = obj("j1", "Job");
  const report = await validateGraph(ctx(), { graph: { objects: [j], links: [] }, rules: JOB_CARD, ...WARN });
  assert.deepEqual(codes(report), ["GRAPH_CARDINALITY"]);
});

test("cardinality: over maximum errors", async () => {
  const j = obj("j1", "Job");
  const s1 = obj("s1", "Submission"); const s2 = obj("s2", "Submission"); const s3 = obj("s3", "Submission");
  const graph: OntologyGraph = { objects: [j, s1, s2, s3], links: [edge("targets", s1, j), edge("targets", s2, j), edge("targets", s3, j)] };
  const report = await validateGraph(ctx(), { graph, rules: JOB_CARD, ...WARN });
  assert.deepEqual(codes(report), ["GRAPH_CARDINALITY"]);
});

// ── Orphans ───────────────────────────────────────────────────────────────────
const ORPHAN_RULES: GraphRule[] = [
  { objectType: "Candidate", mustConnect: true },
  { objectType: "Artifact", mustConnect: true },
];

test("orphans: candidate orphan and artifact orphan detected", async () => {
  const c = obj("c1", "Candidate"); const a = obj("a1", "Artifact"); const other = obj("o1", "Account");
  const linked = obj("c2", "Candidate");
  const graph: OntologyGraph = { objects: [c, a, other, linked], links: [edge("for", linked, other)] };
  const report = await validateGraph(ctx(), { graph, rules: ORPHAN_RULES, ...WARN });
  assert.deepEqual(report.orphanObjects, ["a1", "c1"]);
  assert.equal(report.statistics.orphanCount, 2);
});

// ── Cycles ────────────────────────────────────────────────────────────────────
test("cycles: a valid DAG has no cycle findings", async () => {
  const a = obj("a", "Candidate"); const b = obj("b", "Candidate"); const c = obj("c", "Candidate");
  const graph: OntologyGraph = { objects: [a, b, c], links: [edge("reports_to", a, b), edge("reports_to", b, c)] };
  const report = await validateGraph(ctx(), { graph, rules: [], ...WARN });
  assert.equal(report.cycles.length, 0);
  assert.equal(report.valid, true);
});

test("cycles: an invalid reports_to cycle is detected", async () => {
  const a = obj("a", "Candidate"); const b = obj("b", "Candidate"); const c = obj("c", "Candidate");
  const graph: OntologyGraph = { objects: [a, b, c], links: [edge("reports_to", a, b), edge("reports_to", b, c), edge("reports_to", c, a)] };
  const report = await validateGraph(ctx(), { graph, rules: [], ...WARN });
  assert.equal(report.cycles.length, 1);
  assert.deepEqual(codes(report), ["GRAPH_CYCLE"]);
});

test("cycles: allowed linkType (references) may cycle", async () => {
  const p1 = obj("p1", "Policy"); const p2 = obj("p2", "Policy");
  const graph: OntologyGraph = { objects: [p1, p2], links: [edge("references", p1, p2), edge("references", p2, p1)] };
  const report = await validateGraph(ctx(), { graph, rules: [], config: { cycleAllowedLinkTypes: ["references"] }, ...WARN });
  assert.equal(report.cycles.length, 0);
});

// ── Duplicate edges ───────────────────────────────────────────────────────────
test("duplicate relationships: a duplicate canonical edge is detected", async () => {
  const c = obj("c1", "Candidate"); const s = obj("s1", "Submission");
  const dup = edge("submitted", c, s);
  const graph: OntologyGraph = { objects: [c, s], links: [dup, { ...dup, id: "l_dup" }] };
  const report = await validateGraph(ctx(), { graph, rules: [], ...WARN });
  assert.deepEqual(codes(report), ["GRAPH_DUPLICATE_EDGE"]);
  assert.equal(report.duplicateEdges.length, 1);
});

// ── Invalid paths (illegal shortcut) ──────────────────────────────────────────
test("invalid paths: placement bypassing offer (direct Candidate parent) is illegal", async () => {
  const rules: GraphRule[] = [{ objectType: "Placement", forbiddenParentTypes: ["Candidate"] }];
  const cand = obj("c1", "Candidate"); const pl = obj("pl1", "Placement");
  const graph: OntologyGraph = { objects: [cand, pl], links: [edge("resulted_in_placement", cand, pl)] };
  const report = await validateGraph(ctx(), { graph, rules, ...WARN });
  assert.deepEqual(codes(report), ["GRAPH_INVALID_PATH"]);
  assert.equal(report.invalidPaths.length, 1);
});

// ── Reachability ──────────────────────────────────────────────────────────────
test("reachability: a mission that cannot reach a required type is flagged", async () => {
  const rules: GraphRule[] = [{ objectType: "Mission", reachability: { mustReachTypes: ["Candidate", "Job"] } }];
  const m = obj("m1", "Mission"); const c = obj("c1", "Candidate");
  const graph: OntologyGraph = { objects: [m, c], links: [edge("produces", m, c)] };
  const report = await validateGraph(ctx(), { graph, rules, ...WARN });
  // reaches Candidate but not Job
  assert.deepEqual(codes(report), ["GRAPH_UNREACHABLE"]);
});

// ── Policy ────────────────────────────────────────────────────────────────────
test("policy: offer without an approved interview fails policy", async () => {
  const rules: GraphRule[] = [
    { objectType: "Offer", policies: [{ id: "offer_requires_approved_interview", description: "needs approved interview", related: { linkType: "resulted_in_offer", direction: "in", otherType: "Interview", withStatus: "approved" } }] },
  ];
  const offer = obj("of1", "Offer"); const iv = obj("iv1", "Interview", "pending");
  const graph: OntologyGraph = { objects: [offer, iv], links: [edge("resulted_in_offer", iv, offer)] };
  const report = await validateGraph(ctx(), { graph, rules, ...WARN });
  assert.deepEqual(codes(report), ["GRAPH_POLICY"]);

  // Approving the interview satisfies the policy.
  const iv2 = obj("iv1", "Interview", "approved");
  const ok = await validateGraph(ctx(), { graph: { objects: [offer, iv2], links: [edge("resulted_in_offer", iv2, offer)] }, rules, ...WARN });
  assert.equal(ok.valid, true);
});

// ── Determinism + statistics ──────────────────────────────────────────────────
test("validation is deterministic and reports statistics", async () => {
  const c = obj("c1", "Candidate"); const a = obj("a1", "Artifact");
  const graph: OntologyGraph = { objects: [c, a], links: [] };
  const r1 = await validateGraph(ctx(), { graph, rules: ORPHAN_RULES, ...WARN });
  const r2 = await validateGraph(ctx(), { graph, rules: ORPHAN_RULES, ...WARN });
  assert.deepEqual(r1.errors, r2.errors);
  assert.equal(r1.statistics.objects, 2);
  assert.equal(r1.statistics.edges, 0);
  assert.equal(r1.statistics.disconnectedSubgraphs, 2);
});
