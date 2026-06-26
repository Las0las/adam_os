// Phase 6 — action idempotency: identical input dedupes, force re-runs, failed
// runs do not dedupe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { executeAction, registerAction } from "@/lib/mission-control/actions/action-service";

let calls = 0;
registerAction({
  key: "test_noop",
  async run() {
    calls += 1;
    return { ok: true, calls };
  },
});

let failOnce = true;
registerAction({
  key: "test_flaky",
  async run() {
    if (failOnce) {
      failOnce = false;
      throw new Error("boom");
    }
    return { ok: true };
  },
});

async function fresh() {
  await resetDatabase();
  resetClock();
  calls = 0;
  return systemActor("tnt_test");
}

test("identical input dedupes to the same execution", async () => {
  const ctx = await fresh();
  const a = await executeAction(ctx, { actionKey: "test_noop", input: { x: 1 } });
  const b = await executeAction(ctx, { actionKey: "test_noop", input: { x: 1 } });
  assert.equal(a.id, b.id);
  assert.equal(calls, 1);
});

test("different input runs separately", async () => {
  const ctx = await fresh();
  const a = await executeAction(ctx, { actionKey: "test_noop", input: { x: 1 } });
  const b = await executeAction(ctx, { actionKey: "test_noop", input: { x: 2 } });
  assert.notEqual(a.id, b.id);
  assert.equal(calls, 2);
});

test("force re-executes even with identical input", async () => {
  const ctx = await fresh();
  const a = await executeAction(ctx, { actionKey: "test_noop", input: { x: 1 } });
  const b = await executeAction(ctx, { actionKey: "test_noop", input: { x: 1 }, force: true });
  assert.notEqual(a.id, b.id);
  assert.equal(calls, 2);
});

test("a failed run does not dedupe a retry", async () => {
  const ctx = await fresh();
  failOnce = true;
  const a = await executeAction(ctx, { actionKey: "test_flaky", input: { x: 1 } });
  assert.equal(a.status, "failed");
  const b = await executeAction(ctx, { actionKey: "test_flaky", input: { x: 1 } });
  assert.equal(b.status, "completed");
  assert.notEqual(a.id, b.id);
});
