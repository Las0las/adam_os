// Phase 9 — a sync run creates an audit event + runtime trace (degraded without creds).
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createConnection } from "@/lib/integrations/integration-service";
import { runSync } from "@/lib/integrations/integration-sync-service";
import "@/lib/integrations/register-integrations";

test("sync without credentials is degraded but still traced + audited", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const conn = await createConnection(ctx, { key: "gh", name: "Greenhouse", provider: "greenhouse" });
  const run = await runSync(ctx, conn.id, "full");
  assert.equal(run.status, "degraded");
  assert.ok((await db.runtimeTraces.list(ctx.tenantId, (t) => t.traceType === "integration")).length >= 1);
  assert.ok((await db.auditEvents.list(ctx.tenantId, (a) => a.action === "integration.sync.completed")).length >= 1);
});
