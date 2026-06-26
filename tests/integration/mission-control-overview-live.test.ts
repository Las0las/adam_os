// Phase 6 — the Mission Control overview returns real environments, releases,
// approvals, components, kill switches, and metrics.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { enableKillSwitch } from "@/lib/mission-control/runtime/kill-switch-service";
import { getMissionControlOverview } from "@/lib/mission-control/runtime/runtime-overview-service";
import { setupGovernance, createAndPromoteProdRelease } from "../helpers/mc-flow";

test("overview reflects live governance state", async () => {
  await resetDatabase();
  resetClock();
  const ctx = await setupGovernance();

  await createAndPromoteProdRelease(ctx, "rel-live", [
    { itemType: "function", itemKey: "answer_with_citations", changeType: "enable" },
  ]);
  await enableKillSwitch(ctx, {
    componentType: "function",
    componentKey: "answer_with_citations",
    reason: "pause",
    actorUserId: "usr_admin",
  });

  const overview = await getMissionControlOverview(ctx);
  assert.equal(overview.environments.length, 3);
  assert.ok(overview.releases.some((r) => r.status === "promoted"));
  assert.ok(overview.runtimeComponents.length > 0);
  assert.equal(overview.activeKillSwitches.length, 1);
  assert.equal(overview.metrics.promotedReleases24h, 1);
  assert.equal(overview.metrics.activeKillSwitches, 1);
});
