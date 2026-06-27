// VS-005 Graph Integrity Engine — enforcement modes, governance events, metrics.
// Mirrors VS-003/VS-004 enforcement semantics (warn default; opt-in enforce;
// tenant → global → env → default). In-memory DB backend.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { validateGraph, getGraphMetrics, resetGraphMetrics } from "@/lib/dataops/ontology/graph/graph-integrity";
import { GraphIntegrityError } from "@/lib/dataops/ontology/graph/graph-errors";
import {
  setTenantGraphEnforcementMode,
  setGlobalGraphEnforcementMode,
  resetGraphEnforcementOverrides,
} from "@/lib/dataops/ontology/graph/graph-enforcement";
import type { GraphRule, OntologyGraph, OntologyObject } from "@/lib/dataops/ontology/graph/graph-types";

function obj(id: string, objectType: string): OntologyObject {
  return { id, tenantId: "t", objectType, externalKey: id, title: id, status: null, properties: {}, createdAt: "t0", updatedAt: "t0" };
}
// An invalid graph: a Candidate that must connect but is isolated → GRAPH_ORPHAN.
const RULES: GraphRule[] = [{ objectType: "Candidate", mustConnect: true }];
const INVALID: OntologyGraph = { objects: [obj("c1", "Candidate")], links: [] };
const VALID: OntologyGraph = { objects: [], links: [] };

async function auditByAction(tenantId: string, action: string) {
  return await db.auditEvents.list(tenantId, (e) => e.action === action);
}

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetGraphEnforcementOverrides();
  resetGraphMetrics();
});
afterEach(() => resetGraphEnforcementOverrides());

test("warn mode (default): invalid graph returns a report and does not throw", async () => {
  const ctx = systemActor("tnt_warn");
  const report = await validateGraph(ctx, { graph: INVALID, rules: RULES });
  assert.equal(report.valid, false);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.warning")).length, 1);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.rejected")).length, 0);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.orphan_detected")).length, 1);
});

test("enforce mode: invalid graph throws GraphIntegrityError with the report", async () => {
  const ctx = systemActor("tnt_enf");
  setTenantGraphEnforcementMode(ctx.tenantId, "enforce");
  await assert.rejects(
    () => validateGraph(ctx, { graph: INVALID, rules: RULES }),
    (err: unknown) => {
      assert.ok(err instanceof GraphIntegrityError);
      assert.ok(err.codes.includes("GRAPH_ORPHAN"));
      assert.equal(err.report.valid, false);
      return true;
    },
  );
  assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.rejected")).length, 1);
  assert.equal(getGraphMetrics().graphsRejected, 1);
});

test("valid graph passes in both modes and emits validated", async () => {
  for (const mode of ["warn", "enforce"] as const) {
    await resetDatabase();
    const ctx = systemActor(`tnt_${mode}`);
    const report = await validateGraph(ctx, { graph: VALID, rules: RULES, mode });
    assert.equal(report.valid, true);
    assert.equal((await auditByAction(ctx.tenantId, "ontology.graph.validated")).length, 1);
  }
});

test("tenant override beats default; other tenant unaffected", async () => {
  const enforced = systemActor("tnt_a");
  const defaulted = systemActor("tnt_b");
  setTenantGraphEnforcementMode(enforced.tenantId, "enforce");
  await assert.rejects(() => validateGraph(enforced, { graph: INVALID, rules: RULES }), GraphIntegrityError);
  // tnt_b → default warn → returns a report.
  const report = await validateGraph(defaulted, { graph: INVALID, rules: RULES });
  assert.equal(report.valid, false);
});

test("global override enables enforce across tenants", async () => {
  setGlobalGraphEnforcementMode("enforce");
  const ctx = systemActor("tnt_global");
  await assert.rejects(() => validateGraph(ctx, { graph: INVALID, rules: RULES }), GraphIntegrityError);
});

test("explicit opts.mode overrides resolution", async () => {
  const ctx = systemActor("tnt_opt");
  setTenantGraphEnforcementMode(ctx.tenantId, "enforce");
  // opts.mode forces warn despite tenant enforce → no throw.
  const report = await validateGraph(ctx, { graph: INVALID, rules: RULES, mode: "warn" });
  assert.equal(report.valid, false);
});

test("metrics accumulate across validations", async () => {
  const ctx = systemActor("tnt_metrics");
  await validateGraph(ctx, { graph: INVALID, rules: RULES, mode: "warn" });
  await validateGraph(ctx, { graph: VALID, rules: RULES, mode: "warn" });
  const m = getGraphMetrics();
  assert.equal(m.graphsValidated, 2);
  assert.equal(m.orphansDetected, 1);
});
