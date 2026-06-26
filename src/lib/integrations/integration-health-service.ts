// Phase 9 — integration health. Tests a connection through its adapter, updates
// the connection status, records a runtime health check, and audits. Fail-closed:
// missing credentials yield not_configured/degraded (never active).

import { now } from "@/lib/lawrence-core/utils/ids";
import { getIntegrationAdapter } from "./integration-registry";
import { getCredential } from "./credential-service";
import { getConnection, setConnectionStatus } from "./integration-service";
import { auditIntegration } from "./integration-audit";
import { recordHealthCheck } from "@/lib/mission-control/runtime/health-check-repository";
import type { ActorContext } from "@/types/platform";
import type { HealthStatus } from "@/lib/mission-control/runtime/mission-control-hardening-types";
import type { IntegrationHealthResult } from "./integration-types";

const STATUS_TO_HEALTH: Record<string, HealthStatus> = {
  active: "healthy",
  degraded: "degraded",
  not_configured: "unknown",
  disabled: "unknown",
  failed: "failed",
};

export async function testConnectionHealth(
  ctx: ActorContext,
  connectionId: string,
): Promise<IntegrationHealthResult> {
  const connection = await getConnection(ctx, connectionId);
  if (!connection) throw new Error(`integration connection not found: ${connectionId}`);

  const adapter = getIntegrationAdapter(connection.provider);
  const credential = getCredential(ctx.tenantId, connection.credentialRef);
  const startedAt = Date.parse(now());
  const result = await adapter.testConnection(connection, credential);
  const latencyMs = result.latencyMs ?? Date.parse(now()) - startedAt;

  await setConnectionStatus(ctx, connectionId, result.status);
  await recordHealthCheck({
    tenantId: ctx.tenantId,
    componentType: "integration",
    componentKey: connection.key,
    status: STATUS_TO_HEALTH[result.status] ?? "unknown",
    latencyMs,
    message: result.message,
    details: result.details ?? {},
  });
  await auditIntegration(ctx, "integration.health.checked", connectionId, {
    provider: connection.provider,
    status: result.status,
  });
  return { ...result, latencyMs };
}
