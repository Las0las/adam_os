// Phase 7 — recommendation outcomes compute acceptance rate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import {
  recordRecommendationOutcome,
  getAcceptanceRate,
} from "@/lib/aiops/learning/recommendation-outcome-service";

test("acceptance rate reflects recorded outcomes", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await recordRecommendationOutcome(ctx, { objectType: "Candidate", decision: "accepted" });
  await recordRecommendationOutcome(ctx, { objectType: "Candidate", decision: "accepted" });
  await recordRecommendationOutcome(ctx, { objectType: "Candidate", decision: "rejected" });

  const rate = await getAcceptanceRate(ctx.tenantId);
  assert.equal(rate.total, 3);
  assert.equal(rate.accepted, 2);
  assert.ok(Math.abs(rate.acceptanceRate - 2 / 3) < 1e-9);
});
