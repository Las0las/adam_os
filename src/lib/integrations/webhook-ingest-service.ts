// Phase 9 — webhook ingest. Stores every inbound webhook event, then routes it
// through the connection's adapter (if it handles webhooks). Tenant + connection
// are resolved from the path/config — never trusted blindly. Audited.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { getIntegrationAdapter } from "./integration-registry";
import { auditIntegration } from "./integration-audit";
import type { ActorContext } from "@/types/platform";
import type {
  IntegrationProvider,
  IntegrationWebhookEvent,
  WebhookEventStatus,
} from "./integration-types";

export interface IngestWebhookInput {
  provider: IntegrationProvider;
  connectionKey: string;
  eventType: string;
  externalEventId?: string | null;
  payload: Record<string, unknown>;
  signature?: string | null;
}

export async function ingestWebhook(
  ctx: ActorContext,
  input: IngestWebhookInput,
): Promise<IntegrationWebhookEvent> {
  const connection = await db.integrationConnections.find(
    ctx.tenantId,
    (c) => c.key === input.connectionKey,
  );

  // Always store the raw event first (received), even if no connection matches.
  const event = await db.integrationWebhookEvents.insert({
    id: id("whk"),
    tenantId: ctx.tenantId,
    connectionId: connection?.id ?? null,
    provider: input.provider,
    eventType: input.eventType,
    externalEventId: input.externalEventId ?? null,
    payload: input.payload,
    status: "received",
    processedAt: null,
    errorMessage: null,
    createdAt: now(),
  });

  let status: WebhookEventStatus = "ignored";
  let error: string | null = null;
  if (connection) {
    const adapter = getIntegrationAdapter(connection.provider);
    if (adapter.handleWebhook) {
      try {
        const result = await adapter.handleWebhook({
          connection,
          eventType: input.eventType,
          externalEventId: input.externalEventId ?? null,
          payload: input.payload,
          signature: input.signature ?? null,
        });
        status = result.status;
      } catch (err) {
        status = "failed";
        error = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const updated = await db.integrationWebhookEvents.update(event.id, {
    status,
    processedAt: now(),
    errorMessage: error,
  });
  await auditIntegration(ctx, "integration.webhook.received", connection?.id ?? event.id, {
    provider: input.provider,
    eventType: input.eventType,
    status,
  });
  return updated;
}

export async function listWebhookEvents(
  ctx: ActorContext,
  connectionId?: string,
): Promise<IntegrationWebhookEvent[]> {
  return (
    await db.integrationWebhookEvents.list(
      ctx.tenantId,
      connectionId ? (e) => e.connectionId === connectionId : undefined,
    )
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
