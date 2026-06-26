// Phase 9 — integration sync. Creates a sync run, calls the adapter, records
// object mappings + a runtime trace + audit, and raises a Mission Control
// incident on repeated failures. No fake success — a not_configured connection
// produces a degraded run, not a completed one.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { getIntegrationAdapter } from "./integration-registry";
import { getCredential } from "./credential-service";
import { getConnection, setConnectionStatus } from "./integration-service";
import { auditIntegration } from "./integration-audit";
import { createRuntimeTrace } from "@/lib/aiops/observability/runtime-trace-service";
import {
  countRecentFailures,
  maybeRaiseFailureIncident,
} from "@/lib/mission-control/runtime/failure-threshold";
import type { ActorContext } from "@/types/platform";
import type { IntegrationSyncRun, SyncType } from "./integration-types";

export async function runSync(
  ctx: ActorContext,
  connectionId: string,
  syncType: SyncType = "incremental",
): Promise<IntegrationSyncRun> {
  requirePermission(ctx, "integrations.manage");
  const connection = await getConnection(ctx, connectionId);
  if (!connection) throw new Error(`integration connection not found: ${connectionId}`);

  const run = await db.integrationSyncRuns.insert({
    id: id("isync"),
    tenantId: ctx.tenantId,
    connectionId,
    syncType,
    status: "running",
    startedAt: now(),
    completedAt: null,
    recordsRead: 0,
    recordsWritten: 0,
    assetsCreated: 0,
    errorMessage: null,
    metrics: {},
    createdAt: now(),
  });

  const adapter = getIntegrationAdapter(connection.provider);
  const credential = getCredential(ctx.tenantId, connection.credentialRef);

  try {
    const result = await adapter.sync(connection, { syncType, credential });

    // Persist external→Lawrence object mappings.
    for (const m of result.mappings) {
      await db.integrationObjectMappings.insert({
        id: id("imap"),
        tenantId: ctx.tenantId,
        connectionId,
        externalObjectType: m.externalObjectType,
        externalObjectId: m.externalObjectId,
        lawrenceObjectType: m.lawrenceObjectType,
        lawrenceObjectId: m.lawrenceObjectId,
        metadata: {},
        createdAt: now(),
      });
    }

    const finished = await db.integrationSyncRuns.update(run.id, {
      status: result.status,
      completedAt: now(),
      recordsRead: result.recordsRead,
      recordsWritten: result.recordsWritten,
      assetsCreated: result.assetsCreated,
      errorMessage: result.status === "degraded" ? result.message ?? null : null,
      metrics: result.metrics ?? {},
    });

    await createRuntimeTrace(ctx, {
      traceType: "integration",
      traceId: run.id,
      componentType: "integration",
      componentKey: connection.key,
      status: result.status === "failed" ? "failed" : "completed",
      metrics: {
        syncType,
        recordsRead: result.recordsRead,
        recordsWritten: result.recordsWritten,
        assetsCreated: result.assetsCreated,
      },
      errors: result.status === "degraded" && result.message ? [result.message] : [],
    });

    // Reflect degraded transport onto the connection status.
    if (result.status === "degraded") await setConnectionStatus(ctx, connectionId, "degraded");

    await auditIntegration(ctx, "integration.sync.completed", connectionId, {
      syncType,
      status: result.status,
      recordsRead: result.recordsRead,
    });
    return finished;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await db.integrationSyncRuns.update(run.id, {
      status: "failed",
      completedAt: now(),
      errorMessage: message,
    });
    await setConnectionStatus(ctx, connectionId, "failed");
    await createRuntimeTrace(ctx, {
      traceType: "integration",
      traceId: run.id,
      componentType: "integration",
      componentKey: connection.key,
      status: "failed",
      errors: [message],
    });
    await auditIntegration(ctx, "integration.sync.failed", connectionId, { syncType, error: message });

    // Repeated failures surface in Mission Control.
    const runs = await db.integrationSyncRuns.list(ctx.tenantId, (r) => r.connectionId === connectionId);
    const recentFailures = countRecentFailures(
      runs.map((r) => ({ status: r.status, createdAt: r.createdAt })),
      (r) => r.status === "failed",
    );
    await maybeRaiseFailureIncident(ctx, {
      componentType: "integration",
      componentKey: connection.key,
      recentFailures,
    });
    return failed;
  }
}

export async function listSyncRuns(
  ctx: ActorContext,
  connectionId: string,
): Promise<IntegrationSyncRun[]> {
  return (await db.integrationSyncRuns.list(ctx.tenantId, (r) => r.connectionId === connectionId)).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}
