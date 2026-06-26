// Phase 6 — runtime health check repository. Append-only record of component
// health probes, tenant-scoped.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type {
  HealthStatus,
  RuntimeComponentType,
  RuntimeHealthCheck,
} from "./mission-control-hardening-types";

function sameEnv(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

export async function recordHealthCheck(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
  status: HealthStatus;
  latencyMs?: number | null;
  message?: string | null;
  details?: Record<string, unknown>;
}): Promise<RuntimeHealthCheck> {
  return await db.runtimeHealthChecks.insert({
    id: id("hchk"),
    tenantId: input.tenantId,
    environmentId: input.environmentId ?? null,
    componentType: input.componentType,
    componentKey: input.componentKey,
    status: input.status,
    latencyMs: input.latencyMs ?? null,
    message: input.message ?? null,
    details: input.details ?? {},
    checkedAt: now(),
  });
}

export async function listRecentHealthChecks(
  tenantId: string,
  limit = 50,
): Promise<RuntimeHealthCheck[]> {
  return (await db.runtimeHealthChecks.list(tenantId))
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .slice(0, limit);
}

export async function getLatestComponentHealth(
  tenantId: string,
  componentType: RuntimeComponentType,
  componentKey: string,
  environmentId?: string | null,
): Promise<RuntimeHealthCheck | undefined> {
  return (
    await db.runtimeHealthChecks.list(
      tenantId,
      (c) =>
        c.componentType === componentType &&
        c.componentKey === componentKey &&
        sameEnv(c.environmentId, environmentId),
    )
  ).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}
