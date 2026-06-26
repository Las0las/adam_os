// Phase 7 — repeated recommendation overrides create a ranking learning signal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { recordRecommendationOutcome } from "@/lib/aiops/learning/recommendation-outcome-service";

test("repeated overrides create a ranking signal", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  await recordRecommendationOutcome(ctx, { objectType: "Account", decision: "rejected" });
  const second = await recordRecommendationOutcome(ctx, { objectType: "Account", decision: "modified" });

  assert.ok(second.signal, "second override should raise a ranking signal");
  assert.equal(second.signal!.signalType, "ranking_signal");

  const signals = await db.learningSignals.list(ctx.tenantId);
  assert.equal(signals.length, 1);
});
