// Phase 9 — the CI/CD artifacts exist and a prod release is gate-blocked without eval.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { installMissionControlGovernance } from "@/lib/mission-control/runtime/mission-control-seed";
import { createReleaseBundle } from "@/lib/mission-control/deployments/release-bundle-service";
import { promoteRelease } from "@/lib/mission-control/deployments/release-promotion-service";

test("CI workflow + Dockerfile exist", () => {
  assert.ok(existsSync(".github/workflows/ci.yml"));
  assert.ok(existsSync(".github/workflows/release.yml"));
  assert.ok(existsSync(".github/workflows/evals.yml"));
  assert.ok(existsSync("Dockerfile"));
});

test("prod release is gate-blocked (no eval) — release path is not bypassable", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_ci");
  await installMissionControlGovernance(ctx);
  const { release } = await createReleaseBundle(ctx, {
    key: "ci-rel", name: "ci", releaseType: "function", targetEnvironmentKey: "prod",
    items: [{ itemType: "function", itemKey: "ungated_fn", changeType: "update" }],
  });
  await assert.rejects(() => promoteRelease(ctx, release.id), /requires approval/);
});
