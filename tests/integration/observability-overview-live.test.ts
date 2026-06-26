// Phase 7 — the observability overview reflects real runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { getObservabilityOverview } from "@/lib/aiops/observability/observability-overview-service";

registerFunction({
  key: "ovw_fn",
  name: "ovw fn",
  description: "",
  klass: "summarize",
  outputSchema: {},
  async run() {
    return { output: { ok: true } };
  },
});

test("observability overview shows live run metrics", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await runFunction(ctx, "ovw_fn", {});
  await runFunction(ctx, "ovw_fn", {});

  const overview = await getObservabilityOverview(ctx);
  assert.equal(overview.metrics.totalRuns24h, 2);
  assert.equal(overview.metrics.failedRuns24h, 0);
  assert.ok(overview.byComponent.some((c) => c.componentKey === "ovw_fn"));
});
