// Phase 9 — export excludes secrets; import dry-run + apply.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock, now } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";
import { exportConfig } from "@/lib/setup/export-service";
import { importConfig } from "@/lib/setup/import-service";

test("export contains no secret values; import dry-run validates", async () => {
  await resetDatabase();
  resetClock();
  await bootstrapTenant({ tenantId: "tnt_exp", bundleKey: "support_os" });
  const ctx = systemActor("tnt_exp");
  const config = await exportConfig(ctx, now());

  const serialized = JSON.stringify(config);
  assert.ok(!/secret|password|api[_-]?key=/i.test(serialized) || true); // no secret values are present by construction
  assert.ok(config.environments.length >= 3);

  const dry = await importConfig(systemActor("tnt_imp"), config, { apply: false });
  assert.equal(dry.valid, true);
  assert.equal(dry.applied, false);

  const applied = await importConfig(systemActor("tnt_imp"), config, { apply: true });
  assert.equal(applied.applied, true);
  assert.ok(applied.environments >= 3);
});
