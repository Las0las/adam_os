// Phase 9 — create connection stores credentialRef only, audited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createConnection } from "@/lib/integrations/integration-service";
import "@/lib/integrations/register-integrations";

test("create connection is audited and unknown providers fail closed", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const conn = await createConnection(ctx, { key: "slk", name: "Slack", provider: "slack", credentialRef: "SLACK_TOKEN" });
  assert.equal(conn.credentialRef, "SLACK_TOKEN");
  const audit = await db.auditEvents.list(ctx.tenantId, (a) => a.action === "integration.connection.created");
  assert.equal(audit.length, 1);
  await assert.rejects(() => createConnection(ctx, { key: "x", name: "X", provider: "bogus" as never }), /Unknown integration provider/);
});
