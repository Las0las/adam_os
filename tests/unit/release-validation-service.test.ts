// Phase 6 — release validation computes blockers/warnings, fail-closed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import {
  createEnvironment,
  setEnvironmentStatus,
  getEnvironmentByKey,
} from "@/lib/mission-control/runtime/environment-repository";
import { createReleaseBundle } from "@/lib/mission-control/deployments/release-bundle-service";
import { validateReleaseBundle } from "@/lib/mission-control/deployments/release-validation-service";
import { seedPassingEval } from "../helpers/mc-flow";

async function fresh() {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await createEnvironment({ tenantId: ctx.tenantId, key: "prod", name: "Prod", environmentType: "prod" });
  return ctx;
}

test("empty bundle is blocked", async () => {
  const ctx = await fresh();
  const { release } = await createReleaseBundle(ctx, {
    key: "r-empty",
    name: "Empty",
    releaseType: "mixed",
    targetEnvironmentKey: "prod",
    items: [],
  });
  const result = await validateReleaseBundle(ctx, release.id);
  assert.equal(result.valid, false);
  assert.ok(result.blockers.some((b) => /no items/.test(b)));
});

test("valid bundle warns that prod requires approval", async () => {
  const ctx = await fresh();
  await seedPassingEval(ctx, "function", "answer_with_citations"); // satisfy the eval gate
  const { release } = await createReleaseBundle(ctx, {
    key: "r-ok",
    name: "Ok",
    releaseType: "function",
    targetEnvironmentKey: "prod",
    items: [{ itemType: "function", itemKey: "answer_with_citations", changeType: "update" }],
  });
  const result = await validateReleaseBundle(ctx, release.id);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => /approval/.test(w)));
});

test("inactive target environment blocks", async () => {
  const ctx = await fresh();
  const { release } = await createReleaseBundle(ctx, {
    key: "r-inactive",
    name: "Inactive",
    releaseType: "function",
    targetEnvironmentKey: "prod",
    items: [{ itemType: "function", itemKey: "f1", changeType: "update" }],
  });
  const env = await getEnvironmentByKey(ctx.tenantId, "prod");
  await setEnvironmentStatus({ tenantId: ctx.tenantId, environmentId: env!.id, status: "locked" });
  const result = await validateReleaseBundle(ctx, release.id);
  assert.equal(result.valid, false);
  assert.ok(result.blockers.some((b) => /locked/.test(b)));
});
