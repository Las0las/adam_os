// Phase 6 — a production release cannot be promoted without approval.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { createReleaseBundle } from "@/lib/mission-control/deployments/release-bundle-service";
import { promoteRelease } from "@/lib/mission-control/deployments/release-promotion-service";
import { setupGovernance } from "../helpers/mc-flow";

test("promoting an unapproved prod release fails closed", async () => {
  await resetDatabase();
  resetClock();
  const ctx = await setupGovernance();

  const { release } = await createReleaseBundle(ctx, {
    key: "rel-unapproved",
    name: "Unapproved",
    releaseType: "function",
    targetEnvironmentKey: "prod",
    items: [{ itemType: "function", itemKey: "answer_with_citations", changeType: "enable" }],
  });

  // Straight to promote without submit/approve.
  await assert.rejects(() => promoteRelease(ctx, release.id), /requires approval/);
});
