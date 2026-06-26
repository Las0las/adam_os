// Phase 6 — repeated component failures cross the threshold and raise a single
// (escalating) runtime incident.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { runFunction } from "@/lib/aiops/functions/function-runner";

registerFunction({
  key: "always_fails",
  name: "always fails",
  description: "",
  klass: "summarize",
  outputSchema: {},
  async run() {
    throw new Error("kaboom");
  },
});

test("5 failures in window raise one incident, escalated to critical", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  for (let i = 0; i < 5; i += 1) {
    const run = await runFunction(ctx, "always_fails", { i });
    assert.equal(run.status, "failed");
  }

  const incidents = await db.runtimeIncidents.list(ctx.tenantId, (x) => x.source === "runtime_threshold");
  assert.equal(incidents.length, 1, "exactly one threshold incident (deduped)");
  assert.equal(incidents[0]!.severity, "critical");
});
