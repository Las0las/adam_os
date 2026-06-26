// Phase 9 — integration connection service. Tenant-scoped CRUD over connections.
// Stores credentialRef only (never secrets). Status is derived from credential
// presence at create time and updated by health/sync.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { validateCredentialRef } from "./credential-service";
import { auditIntegration } from "./integration-audit";
import { hasIntegrationAdapter } from "./integration-registry";
import type { ActorContext } from "@/types/platform";
import type {
  IntegrationConnection,
  IntegrationProvider,
  IntegrationStatus,
} from "./integration-types";

export interface CreateConnectionInput {
  key: string;
  name: string;
  provider: IntegrationProvider;
  config?: Record<string, unknown>;
  credentialRef?: string | null;
}

export async function createConnection(
  ctx: ActorContext,
  input: CreateConnectionInput,
): Promise<IntegrationConnection> {
  requirePermission(ctx, "integrations.manage");
  if (!hasIntegrationAdapter(input.provider)) {
    throw new Error(`Unknown integration provider '${input.provider}' (fail-closed).`);
  }
  const existing = await db.integrationConnections.find(ctx.tenantId, (c) => c.key === input.key);
  if (existing) return existing;

  // Status reflects credential presence; never assume configured.
  const hasCred = validateCredentialRef(ctx.tenantId, input.credentialRef).present;
  const status: IntegrationStatus = hasCred ? "active" : "not_configured";

  const connection = await db.integrationConnections.insert({
    id: id("intg"),
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    provider: input.provider,
    status,
    config: input.config ?? {},
    credentialRef: input.credentialRef ?? null,
    createdBy: ctx.actorUserId ?? null,
    createdAt: now(),
    updatedAt: now(),
  });
  await auditIntegration(ctx, "integration.connection.created", connection.id, {
    provider: input.provider,
    configured: hasCred,
  });
  return connection;
}

export async function listConnections(ctx: ActorContext): Promise<IntegrationConnection[]> {
  return (await db.integrationConnections.list(ctx.tenantId)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function getConnection(
  ctx: ActorContext,
  connectionId: string,
): Promise<IntegrationConnection | undefined> {
  return await db.integrationConnections.get(ctx.tenantId, connectionId);
}

export async function setConnectionStatus(
  ctx: ActorContext,
  connectionId: string,
  status: IntegrationStatus,
): Promise<IntegrationConnection> {
  const connection = await db.integrationConnections.get(ctx.tenantId, connectionId);
  if (!connection) throw new Error(`integration connection not found: ${connectionId}`);
  return await db.integrationConnections.update(connection.id, { status, updatedAt: now() });
}
