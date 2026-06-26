// Phase 8 — installing a pack is idempotent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import "@/lib/domain-packs/packs";

test("install is idempotent by tenant + key + version", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const manifest = getDomainPackManifest("healthcare_ops")!;

  const first = await installDomainPack(ctx, manifest);
  assert.equal(first.alreadyInstalled, false);
  const second = await installDomainPack(ctx, manifest);
  assert.equal(second.alreadyInstalled, true);
  assert.equal(first.installation.id, second.installation.id);

  const installs = await db.domainPackInstallations.list(ctx.tenantId, (i) => i.packKey === "healthcare_ops");
  assert.equal(installs.length, 1);

  // Demo objects were created and marked demo.
  const demoObjects = await db.ontologyObjects.list(ctx.tenantId, (o) => o.properties.__packKey === "healthcare_ops");
  assert.ok(demoObjects.length >= 3);
  assert.equal(demoObjects[0]!.properties.__demo, true);
});
