// Phase 8 — uninstall safe mode keeps customer + demo objects; removeDemoData
// removes only demo objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { uninstallDomainPack } from "@/lib/domain-packs/domain-pack-uninstaller";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import "@/lib/domain-packs/packs";

test("safe-mode uninstall does not delete objects; removeDemoData removes demo only", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await installDomainPack(ctx, getDomainPackManifest("healthcare_ops")!);
  const user = await upsertObject(ctx, { objectType: "Provider", externalKey: "real-provider", title: "Real Provider" });

  // Safe mode: installation marked uninstalled, no objects removed.
  const safe = await uninstallDomainPack(ctx, "healthcare_ops");
  assert.equal(safe.removedDemoObjects, 0);
  assert.equal(safe.installation.status, "uninstalled");
  assert.ok((await db.ontologyObjects.list(ctx.tenantId, (o) => o.properties.__packKey === "healthcare_ops")).length > 0);

  // Reinstall, then uninstall with removeDemoData.
  await installDomainPack(ctx, getDomainPackManifest("healthcare_ops")!);
  const hard = await uninstallDomainPack(ctx, "healthcare_ops", { removeDemoData: true });
  assert.ok(hard.removedDemoObjects > 0);
  assert.ok(await db.ontologyObjects.get(ctx.tenantId, user.id), "customer object preserved");
});
