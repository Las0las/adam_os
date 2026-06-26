// Phase 7 — rollups aggregate traces + usage into a window.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createRuntimeTrace } from "@/lib/aiops/observability/runtime-trace-service";
import { recordAiUsage } from "@/lib/aiops/observability/ai-usage-service";
import { buildHourlyRollup } from "@/lib/aiops/observability/observability-rollup-service";

test("hourly rollup counts runs, failures, and cost", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await createRuntimeTrace(ctx, { traceType: "function_run", traceId: "f1", componentType: "function", componentKey: "fn", status: "completed", metrics: { latencyMs: 10 } });
  await createRuntimeTrace(ctx, { traceType: "function_run", traceId: "f2", componentType: "function", componentKey: "fn", status: "failed", errors: ["x"] });
  await recordAiUsage(ctx, { runType: "function_run", runId: "f1", modelKey: "m", estimatedCost: 0.5, latencyMs: 10, status: "completed" });

  const rollup = await buildHourlyRollup(ctx.tenantId);
  assert.equal(rollup.metrics.runCount, 2);
  assert.equal(rollup.metrics.failureCount, 1);
  assert.equal(rollup.metrics.estimatedCost, 0.5);
});
