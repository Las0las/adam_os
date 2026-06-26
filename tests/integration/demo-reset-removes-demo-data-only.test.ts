// Phase 8 — demo reset removes demo data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { runDemo } from "@/lib/demo/demo-runner";
import { resetDemo } from "@/lib/demo/demo-reset-service";
import "@/lib/domain-packs/packs";

test("reset after a demo removes demo objects but keeps user objects", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await runDemo(ctx, "professional_services", "margin-leakage-detection");
  const user = await upsertObject(ctx, { objectType: "Client", externalKey: "real-client", title: "Real Client" });

  const result = await resetDemo(ctx, "professional_services", { removeTraces: true });
  assert.ok(result.removedObjects > 0);
  assert.ok(await db.ontologyObjects.get(ctx.tenantId, user.id), "user object kept");
  assert.equal((await db.ontologyObjects.list(ctx.tenantId, (o) => o.properties.__packKey === "professional_services")).length, 0);

  const audit = await db.auditEvents.list(ctx.tenantId, (a) => a.action === "demo.reset.completed");
  assert.equal(audit.length, 1);
});
