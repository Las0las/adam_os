// Phase 7 — running a function emits a runtime trace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { runFunction } from "@/lib/aiops/functions/function-runner";

registerFunction({
  key: "trace_fn",
  name: "trace fn",
  description: "",
  klass: "summarize",
  outputSchema: {},
  async run() {
    return { output: { ok: true } };
  },
});

test("function run creates a runtime trace", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const run = await runFunction(ctx, "trace_fn", {});
  assert.equal(run.status, "completed");

  const traces = await db.runtimeTraces.list(ctx.tenantId, (t) => t.traceType === "function_run");
  assert.equal(traces.length, 1);
  assert.equal(traces[0]!.componentKey, "trace_fn");
  assert.equal(traces[0]!.status, "completed");
});
