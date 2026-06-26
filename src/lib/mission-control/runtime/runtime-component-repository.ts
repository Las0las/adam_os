// Phase 6 — runtime component repository. Tenant-scoped registry of deployed
// runtime components (function/agent/action/pipeline/...) per environment. The
// upsert keys on (componentType, componentKey, environmentId) to mirror the
// reference unique constraint.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type {
  HealthStatus,
  RuntimeComponent,
  RuntimeComponentStatus,
  RuntimeComponentType,
} from "./mission-control-hardening-types";

function sameEnv(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

export async function getRuntimeComponent(
  tenantId: string,
  componentType: RuntimeComponentType,
  componentKey: string,
  environmentId?: string | null,
): Promise<RuntimeComponent | undefined> {
  return await db.runtimeComponents.find(
    tenantId,
    (c) =>
      c.componentType === componentType &&
      c.componentKey === componentKey &&
      sameEnv(c.environmentId, environmentId),
  );
}

export async function upsertRuntimeComponent(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  componentId?: string | null;
  environmentId?: string | null;
  status?: RuntimeComponentStatus;
  version?: number | null;
  config?: Record<string, unknown>;
}): Promise<RuntimeComponent> {
  const existing = await getRuntimeComponent(
    input.tenantId,
    input.componentType,
    input.componentKey,
    input.environmentId,
  );
  if (existing) {
    return await db.runtimeComponents.update(existing.id, {
      status: input.status ?? existing.status,
      version: input.version ?? existing.version,
      componentId: input.componentId ?? existing.componentId,
      config: input.config ?? existing.config,
      updatedAt: now(),
    });
  }
  return await db.runtimeComponents.insert({
    id: id("rcmp"),
    tenantId: input.tenantId,
    componentType: input.componentType,
    componentKey: input.componentKey,
    componentId: input.componentId ?? null,
    environmentId: input.environmentId ?? null,
    status: input.status ?? "enabled",
    version: input.version ?? null,
    config: input.config ?? {},
    lastHealthStatus: null,
    lastHealthCheckedAt: null,
    createdAt: now(),
    updatedAt: now(),
  });
}

export async function listRuntimeComponents(
  tenantId: string,
  filters: {
    componentType?: RuntimeComponentType;
    environmentId?: string | null;
    status?: RuntimeComponentStatus;
  } = {},
): Promise<RuntimeComponent[]> {
  return await db.runtimeComponents.list(tenantId, (c) => {
    if (filters.componentType && c.componentType !== filters.componentType) return false;
    if (filters.environmentId !== undefined && !sameEnv(c.environmentId, filters.environmentId))
      return false;
    if (filters.status && c.status !== filters.status) return false;
    return true;
  });
}

export async function setRuntimeComponentStatus(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
  status: RuntimeComponentStatus;
  lastHealthStatus?: HealthStatus | null;
}): Promise<RuntimeComponent> {
  const existing = await getRuntimeComponent(
    input.tenantId,
    input.componentType,
    input.componentKey,
    input.environmentId,
  );
  if (!existing) {
    // Upsert-on-status keeps callers simple: a status change implicitly
    // registers the component if it wasn't known yet.
    const created = await upsertRuntimeComponent({ ...input });
    if (input.lastHealthStatus) {
      return await db.runtimeComponents.update(created.id, {
        lastHealthStatus: input.lastHealthStatus,
        lastHealthCheckedAt: now(),
      });
    }
    return created;
  }
  return await db.runtimeComponents.update(existing.id, {
    status: input.status,
    lastHealthStatus: input.lastHealthStatus ?? existing.lastHealthStatus,
    lastHealthCheckedAt: input.lastHealthStatus ? now() : existing.lastHealthCheckedAt,
    updatedAt: now(),
  });
}
