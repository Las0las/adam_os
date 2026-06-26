// Phase 6 — notification dedupe suppresses duplicates; a kill-switched rule
// queues internally instead of delivering.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import {
  createNotificationRule,
  emitEvent,
} from "@/lib/mission-control/notifications/notification-service";
import { enableKillSwitch } from "@/lib/mission-control/runtime/kill-switch-repository";

async function fresh() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

test("duplicate emits are deduped to one notification row", async () => {
  const ctx = await fresh();
  await createNotificationRule(ctx, {
    name: "review-open",
    eventKey: "review.created",
    channel: "in_app",
    template: "review {{subjectId}}",
  });

  await emitEvent(ctx, "review.created", "usr_1", { subjectId: "rc_1" });
  await emitEvent(ctx, "review.created", "usr_1", { subjectId: "rc_1" });

  const rows = await db.notifications.list(ctx.tenantId, (n) => n.recipientUserId === "usr_1");
  assert.equal(rows.length, 1, "second identical emit deduped");
});

test("kill-switched notification rule queues internally", async () => {
  const ctx = await fresh();
  await createNotificationRule(ctx, {
    name: "alerts",
    eventKey: "alert.raised",
    channel: "in_app",
    template: "alert",
  });
  await enableKillSwitch({
    tenantId: ctx.tenantId,
    componentType: "notification_rule",
    componentKey: "alerts",
    environmentId: null,
    reason: "noisy",
  });

  const notes = await emitEvent(ctx, "alert.raised", "usr_2", { subjectId: "a1" });
  assert.equal(notes[0]!.state, "queued");
  assert.match(notes[0]!.error ?? "", /kill switch/);
});
