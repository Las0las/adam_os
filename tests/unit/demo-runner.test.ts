// Phase 8 — demo runner executes real services to completion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { runDemo } from "@/lib/demo/demo-runner";
import "@/lib/domain-packs/packs";

test("healthcare demo runs through real services and completes", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  const run = await runDemo(ctx, "healthcare_ops", "referral-authorization-risk");
  assert.equal(run.status, "completed");
  assert.ok(run.trace.steps.length >= 5);

  // Install + run_function steps produced real artifacts.
  const installStep = run.trace.steps.find((s) => s.action === "install_pack");
  assert.equal(installStep?.status, "completed");
  const fnStep = run.trace.steps.find((s) => s.action === "run_function");
  assert.equal(fnStep?.status, "completed");

  // A real function run + runtime trace exist.
  assert.ok((await db.functionRuns.list(ctx.tenantId)).length >= 1);
  assert.ok((await db.runtimeTraces.list(ctx.tenantId, (t) => t.traceType === "function_run")).length >= 1);
  // Demo objects exist and are marked demo.
  assert.ok((await db.ontologyObjects.list(ctx.tenantId, (o) => o.properties.__demo === true)).length >= 3);
});
