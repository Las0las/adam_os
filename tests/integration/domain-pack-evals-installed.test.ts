// Phase 8 — each pack installs its eval suites.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { listDomainPackManifests } from "@/lib/domain-packs/domain-pack-registry";
import "@/lib/domain-packs/packs";

test("every pack installs at least one eval suite", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  for (const manifest of listDomainPackManifests()) {
    await installDomainPack(ctx, manifest);
    for (const suite of manifest.evalSuites) {
      const found = await db.evalSuites.find(ctx.tenantId, (s) => s.key === suite.key);
      assert.ok(found, `expected eval suite ${suite.key} for pack ${manifest.key}`);
    }
  }
});
