// Phase 7 — a function run records an AI usage event tagged with the provider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { runFunction } from "@/lib/aiops/functions/function-runner";

registerFunction({
  key: "usage_fn",
  name: "usage fn",
  description: "",
  klass: "summarize",
  outputSchema: {},
  async run() {
    return { output: { ok: true } };
  },
});

test("model call records an ai usage event", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await runFunction(ctx, "usage_fn", {});

  const usage = await db.aiUsageEvents.list(ctx.tenantId, (e) => e.runType === "function_run");
  assert.equal(usage.length, 1);
  assert.equal(usage[0]!.provider, "mock"); // default deterministic provider
  assert.equal(usage[0]!.status, "completed");
});
