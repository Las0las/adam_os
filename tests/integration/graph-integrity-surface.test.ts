// VS-006 — Graph Integrity Review Surface service. Validates the on-demand,
// read-only review over a real tenant graph: pass on an empty graph, failed when
// default rules are violated, read-only (no writes), permission-gated, scoped, and
// deterministic. In-memory DB backend.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor, PermissionError } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { getGraphIntegritySurface } from "@/lib/dataops/ontology/graph/graph-surface-service";
import { resetGraphMetrics } from "@/lib/dataops/ontology/graph/graph-integrity";
import { resetGraphEnforcementOverrides } from "@/lib/dataops/ontology/graph/graph-enforcement";
import type { ActorContext } from "@/types/platform";

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetGraphMetrics();
  resetGraphEnforcementOverrides();
});

test("pass state: an empty tenant graph passes review", async () => {
  const ctx = systemActor("tnt_pass");
  const surface = await getGraphIntegritySurface(ctx);
  assert.equal(surface.summary.governanceState, "pass");
  assert.equal(surface.summary.totalFindings, 0);
});

test("failed state: a Candidate with no resume violates default graph rules", async () => {
  const ctx = systemActor("tnt_fail");
  await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: "c1",
    title: "Ada",
    status: "new",
    properties: { fullName: "Ada", email: "ada@example.com" },
  });
  const before = (await db.ontologyObjects.list(ctx.tenantId)).length;

  const surface = await getGraphIntegritySurface(ctx);

  assert.equal(surface.summary.governanceState, "failed");
  assert.ok(surface.summary.blockingFindings > 0);
  // Traceable to VS-005 codes: Candidate is an orphan + missing required resume.
  const codes = new Set(surface.report.errors.map((e) => e.code));
  assert.ok(codes.has("GRAPH_ORPHAN") || codes.has("GRAPH_REQUIRED_RELATIONSHIP"));
  assert.ok(surface.summary.wouldRejectInEnforce);

  // Read-only: review created no objects/links.
  const after = (await db.ontologyObjects.list(ctx.tenantId)).length;
  assert.equal(after, before);
  assert.equal((await db.ontologyLinks.list(ctx.tenantId)).length, 0);
});

test("review never throws even when the graph is invalid (warn-mode review)", async () => {
  const ctx = systemActor("tnt_nothrow");
  await upsertObject(ctx, { objectType: "Artifact", externalKey: "a1", title: "Doc", status: "new", properties: {} });
  // Does not reject despite an orphan Artifact.
  const surface = await getGraphIntegritySurface(ctx);
  assert.equal(surface.summary.governanceState, "failed");
});

test("permission required: ontology.admin", async () => {
  const limited: ActorContext = { tenantId: "tnt_perm", actorUserId: null, permissions: ["review.reviewer"] };
  await assert.rejects(() => getGraphIntegritySurface(limited), PermissionError);
});

test("scope filter validates only the selected object types", async () => {
  const ctx = systemActor("tnt_scope");
  await upsertObject(ctx, { objectType: "Candidate", externalKey: "c1", title: "Ada", status: "new", properties: { fullName: "Ada" } });
  await upsertObject(ctx, { objectType: "Account", externalKey: "a1", title: "Acme", status: "active", properties: {} });

  // Scope to Account only → no Candidate findings; Account has no failing rule.
  const scoped = await getGraphIntegritySurface(ctx, { objectTypes: ["Account"] });
  assert.equal(scoped.target.objectTypes?.[0], "Account");
  assert.ok(scoped.report.errors.every((e) => e.objectType !== "Candidate"));
});

test("review is deterministic", async () => {
  const ctx = systemActor("tnt_det");
  await upsertObject(ctx, { objectType: "Candidate", externalKey: "c1", title: "Ada", status: "new", properties: { fullName: "Ada" } });
  const a = await getGraphIntegritySurface(ctx);
  const b = await getGraphIntegritySurface(ctx);
  assert.deepEqual(a.report.errors, b.report.errors);
  assert.deepEqual(a.groups.byCode.map((g) => g.key), b.groups.byCode.map((g) => g.key));
});
