// Phase 9 — webhook events are stored and processed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createConnection } from "@/lib/integrations/integration-service";
import { ingestWebhook } from "@/lib/integrations/webhook-ingest-service";
import "@/lib/integrations/register-integrations";

test("webhook event is stored and routed", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await createConnection(ctx, { key: "wh1", name: "Webhook", provider: "webhook" });
  const event = await ingestWebhook(ctx, { provider: "webhook", connectionKey: "wh1", eventType: "ticket.created", payload: { id: "t1" } });
  assert.equal(event.status, "processed");
  assert.equal((await db.integrationWebhookEvents.list(ctx.tenantId)).length, 1);
});
