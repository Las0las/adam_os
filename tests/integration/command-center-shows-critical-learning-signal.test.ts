// Phase 7 — a critical/high open learning signal surfaces in the Command Center
// risk queue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createLearningSignal } from "@/lib/aiops/learning/learning-signal-service";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";

test("critical learning signal shows in the risk queue", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await createLearningSignal(ctx, {
    signalType: "policy_gap",
    severity: "critical",
    summary: "Unsafe recommendation reached review",
  });

  const overview = await getCommandCenterOverview(ctx);
  assert.ok(
    overview.riskQueue.some((i) => i.kind === "learning_signal"),
    "expected a learning_signal in the risk queue",
  );
});
