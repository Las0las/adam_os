// Proves the notification rule + emit path: a rule for "review_case.created"
// produces a delivered notification row when the event is emitted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import {
  createNotificationRule,
  emitEvent,
  listNotifications,
} from "@/lib/mission-control/notifications/notification-service";

test("emitting review_case.created delivers a notification via the rule", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  await createNotificationRule(ctx, {
    name: "Review case opened",
    eventKey: "review_case.created",
    channel: "in_app",
    template: "A new review case requires attention: {{summary}}",
  });

  const emitted = await emitEvent(ctx, "review_case.created", "usr_reviewer", {
    summary: "Low-confidence extraction",
  });
  assert.equal(emitted.length, 1);

  const notes = await listNotifications(ctx, "usr_reviewer");
  assert.ok(notes.length >= 1, "expected a notification row");
  assert.equal(notes[0]?.state, "sent");
});
