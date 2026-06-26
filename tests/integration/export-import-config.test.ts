// Phase 9 — export/import round-trips config without secrets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock, now } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";
import { exportConfig } from "@/lib/setup/export-service";
import { importConfig } from "@/lib/setup/import-service";
import { listEnvironments } from "@/lib/mission-control/runtime/environment-repository";

test("config round-trips into a fresh tenant without secrets", async () => {
  await resetDatabase();
  resetClock();
  await bootstrapTenant({ tenantId: "tnt_src", bundleKey: "support_os", integrationShells: [{ key: "slk", name: "Slack", provider: "slack" }] });
  const config = await exportConfig(systemActor("tnt_src"), now());
  // Integration shells carry ref names only (here none set), never secret values.
  assert.ok(config.integrationConnections.every((c) => !("secret" in c)));

  await importConfig(systemActor("tnt_dest"), config, { apply: true });
  assert.ok((await listEnvironments("tnt_dest")).length >= 3);
});
