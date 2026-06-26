// Phase 6 — kill switch guard blocks killed components, env-specific + global.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { enableKillSwitch } from "@/lib/mission-control/runtime/kill-switch-repository";
import {
  assertNotKilled,
  isKilled,
  RuntimeKilledError,
} from "@/lib/mission-control/runtime/kill-switch-guard";

async function fresh() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

test("assertNotKilled passes when no switch exists", async () => {
  const ctx = await fresh();
  await assertNotKilled({ tenantId: ctx.tenantId, componentType: "function", componentKey: "f1" });
});

test("global (null-env) kill switch blocks execution", async () => {
  const ctx = await fresh();
  await enableKillSwitch({
    tenantId: ctx.tenantId,
    componentType: "function",
    componentKey: "f1",
    environmentId: null,
    reason: "incident",
  });
  assert.equal(await isKilled({ tenantId: ctx.tenantId, componentType: "function", componentKey: "f1" }), true);
  await assert.rejects(
    () => assertNotKilled({ tenantId: ctx.tenantId, componentType: "function", componentKey: "f1" }),
    RuntimeKilledError,
  );
});

test("kill switch is tenant + component scoped", async () => {
  const ctx = await fresh();
  await enableKillSwitch({
    tenantId: ctx.tenantId,
    componentType: "function",
    componentKey: "f1",
    environmentId: null,
    reason: "x",
  });
  // Different component is unaffected.
  assert.equal(await isKilled({ tenantId: ctx.tenantId, componentType: "function", componentKey: "f2" }), false);
  // Different tenant is unaffected.
  assert.equal(await isKilled({ tenantId: "tnt_other", componentType: "function", componentKey: "f1" }), false);
});
