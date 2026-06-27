// VS-007 — Mission / Workflow Graph Preflight. Machine-facing gate over the VS-005
// engine: advisory in warn mode, blocking in enforce mode. Deterministic; findings
// traceable to GRAPH_* codes; emits governance events + metrics. In-memory DB.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import {
  preflightGraph,
  MissionPreflightError,
  WorkflowPreflightError,
  getPreflightMetrics,
  resetPreflightMetrics,
} from "@/lib/dataops/ontology/graph/graph-preflight";
import { resetGraphMetrics } from "@/lib/dataops/ontology/graph/graph-integrity";
import { resetGraphEnforcementOverrides } from "@/lib/dataops/ontology/graph/graph-enforcement";
import type { GraphRule, OntologyGraph, OntologyObject } from "@/lib/dataops/ontology/graph/graph-types";

function obj(id: string, objectType: string): OntologyObject {
  return { id, tenantId: "t", objectType, externalKey: id, title: id, status: null, properties: {}, createdAt: "t0", updatedAt: "t0" };
}

// Blocking (error-severity) rule: a Candidate that must connect but is isolated.
const BLOCKING_RULES: GraphRule[] = [{ objectType: "Candidate", mustConnect: true }];
// Warning-severity rule: a missing required relationship reported as a warning.
const WARNING_RULES: GraphRule[] = [
  { objectType: "Candidate", requiredRelationships: [{ linkType: "has_resume", direction: "out", min: 1, severity: "warning" }] },
];
const INVALID: OntologyGraph = { objects: [obj("c1", "Candidate")], links: [] };
const EMPTY: OntologyGraph = { objects: [], links: [] };

async function auditByAction(tenantId: string, action: string) {
  return await db.auditEvents.list(tenantId, (e) => e.action === action);
}

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetGraphEnforcementOverrides();
  resetGraphMetrics();
  resetPreflightMetrics();
});
afterEach(() => resetGraphEnforcementOverrides());

test("pass graph returns pass", async () => {
  const ctx = systemActor("tnt_pass");
  const r = await preflightGraph(ctx, { subjectType: "mission", subjectId: "m1", graph: EMPTY, rules: BLOCKING_RULES });
  assert.equal(r.status, "pass");
  assert.equal(r.recommendedHumanAction, null);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.preflight.passed")).length, 1);
  assert.equal(getPreflightMetrics().preflightsPassed, 1);
});

test("warning graph returns warning in warn mode (advisory only)", async () => {
  const ctx = systemActor("tnt_w");
  const r = await preflightGraph(ctx, { subjectType: "workflow", subjectId: "w1", graph: INVALID, rules: WARNING_RULES, mode: "warn" });
  assert.equal(r.status, "warning");
  assert.ok(r.warningFindings.length > 0);
  assert.equal(r.blockingFindings.length, 0);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.preflight.warning")).length, 1);
});

test("blocking graph returns warning in warn mode (never blocks)", async () => {
  const ctx = systemActor("tnt_wb");
  const r = await preflightGraph(ctx, { subjectType: "mission", subjectId: "m1", graph: INVALID, rules: BLOCKING_RULES, mode: "warn" });
  assert.equal(r.status, "warning"); // blocking finding present, but warn mode is advisory
  assert.ok(r.blockingFindings.some((f) => f.code === "GRAPH_ORPHAN"));
  assert.ok(r.recommendedHumanAction?.includes("GRAPH_ORPHAN"));
});

test("blocking graph throws MissionPreflightError in enforce mode", async () => {
  const ctx = systemActor("tnt_enf");
  await assert.rejects(
    () => preflightGraph(ctx, { subjectType: "mission", subjectId: "m1", graph: INVALID, rules: BLOCKING_RULES, mode: "enforce" }),
    (err: unknown) => {
      assert.ok(err instanceof MissionPreflightError);
      assert.equal(err.result.status, "blocked");
      assert.ok(err.codes.includes("GRAPH_ORPHAN")); // GRAPH_* traceability
      assert.ok(err.result.affectedObjects.includes("c1"));
      return true;
    },
  );
  assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.preflight.blocked")).length, 1);
  assert.equal(getPreflightMetrics().preflightsBlocked, 1);
});

test("workflow subject throws WorkflowPreflightError in enforce mode", async () => {
  const ctx = systemActor("tnt_enf_wf");
  await assert.rejects(
    () => preflightGraph(ctx, { subjectType: "workflow", subjectId: "wf1", graph: INVALID, rules: BLOCKING_RULES, mode: "enforce" }),
    WorkflowPreflightError,
  );
});

test("enforce mode with only warnings does not block", async () => {
  const ctx = systemActor("tnt_enf_warn");
  const r = await preflightGraph(ctx, { subjectType: "mission", subjectId: "m1", graph: INVALID, rules: WARNING_RULES, mode: "enforce" });
  assert.equal(r.status, "warning"); // enforce blocks only on blocking (error) findings
});

test("findings preserve GRAPH_* traceability", async () => {
  const ctx = systemActor("tnt_trace");
  const r = await preflightGraph(ctx, { subjectType: "mission", subjectId: "m1", graph: INVALID, rules: BLOCKING_RULES, mode: "warn" });
  assert.ok(r.findings.every((f) => f.code.startsWith("GRAPH_")));
});

test("preflight is deterministic", async () => {
  const ctx = systemActor("tnt_det");
  const a = await preflightGraph(ctx, { subjectType: "mission", subjectId: "m1", graph: INVALID, rules: BLOCKING_RULES, mode: "warn" });
  const b = await preflightGraph(ctx, { subjectType: "mission", subjectId: "m1", graph: INVALID, rules: BLOCKING_RULES, mode: "warn" });
  assert.deepEqual(a.findings, b.findings);
  assert.deepEqual(a.affectedObjects, b.affectedObjects);
});
