// Phase 8 — claims demo runs through real services to completion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { runDemo } from "@/lib/demo/demo-runner";
import "@/lib/domain-packs/packs";

test("claims demo completes with real artifacts", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const run = await runDemo(ctx, "claims", "email-attachment-validation");
  assert.equal(run.status, "completed");
  // Demo objects + a function run trace exist.
  assert.ok((await db.ontologyObjects.list(ctx.tenantId, (o) => o.properties.__demo === true)).length > 0);
  assert.ok((await db.runtimeTraces.list(ctx.tenantId, (t) => t.traceType === "function_run")).length >= 1);
});
