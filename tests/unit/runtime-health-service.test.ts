// Phase 6 — runtime health probes record status and reflect onto components.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import { runHealthCheckForComponent } from "@/lib/mission-control/runtime/health-service";
import { getRuntimeComponent } from "@/lib/mission-control/runtime/runtime-component-repository";

registerAction({ key: "health_test_action", async run() { return { ok: true }; } });

async function fresh() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

test("registered action probes healthy", async () => {
  const ctx = await fresh();
  const check = await runHealthCheckForComponent(ctx, {
    componentType: "action",
    componentKey: "health_test_action",
  });
  assert.equal(check.status, "healthy");
  const comp = await getRuntimeComponent(ctx.tenantId, "action", "health_test_action", null);
  assert.equal(comp?.lastHealthStatus, "healthy");
  assert.equal(comp?.status, "enabled");
});

test("unregistered action probes failed", async () => {
  const ctx = await fresh();
  const check = await runHealthCheckForComponent(ctx, {
    componentType: "action",
    componentKey: "does_not_exist",
  });
  assert.equal(check.status, "failed");
  const comp = await getRuntimeComponent(ctx.tenantId, "action", "does_not_exist", null);
  assert.equal(comp?.status, "failed");
});

test("missing pipeline definition probes failed", async () => {
  const ctx = await fresh();
  const check = await runHealthCheckForComponent(ctx, {
    componentType: "pipeline",
    componentKey: "ghost_pipeline",
  });
  assert.equal(check.status, "failed");
});
