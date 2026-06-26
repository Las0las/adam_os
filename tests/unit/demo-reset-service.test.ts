// Phase 8 — demo reset removes only demo objects, never user objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import { resetDemo } from "@/lib/demo/demo-reset-service";
import "@/lib/domain-packs/packs";

test("reset removes demo objects only", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await installDomainPack(ctx, getDomainPackManifest("healthcare_ops")!);

  // A real customer object (not demo).
  const userObj = await upsertObject(ctx, { objectType: "Provider", externalKey: "real-provider", title: "Real Provider" });

  const result = await resetDemo(ctx, "healthcare_ops", { removeTraces: true });
  assert.ok(result.removedObjects >= 3);

  // Customer object survives.
  assert.ok(await db.ontologyObjects.get(ctx.tenantId, userObj.id));
  // Demo objects are gone.
  assert.equal((await db.ontologyObjects.list(ctx.tenantId, (o) => o.properties.__packKey === "healthcare_ops")).length, 0);
});
