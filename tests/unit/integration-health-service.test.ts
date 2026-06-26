// Phase 9 — health test fail-closes to not_configured without credentials.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createConnection } from "@/lib/integrations/integration-service";
import { testConnectionHealth } from "@/lib/integrations/integration-health-service";
import "@/lib/integrations/register-integrations";

test("test connection without credentials is not_configured", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const conn = await createConnection(ctx, { key: "gh", name: "Greenhouse", provider: "greenhouse" });
  assert.equal(conn.status, "not_configured");

  const result = await testConnectionHealth(ctx, conn.id);
  assert.equal(result.status, "not_configured");
  // A health check was recorded.
  assert.ok((await db.runtimeHealthChecks.list(ctx.tenantId, (h) => h.componentType === "integration")).length >= 1);
});
