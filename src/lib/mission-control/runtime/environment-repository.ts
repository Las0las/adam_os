// Phase 6 — environment repository. Tenant-scoped access to deployment
// environments (dev/staging/prod). All reads filter by tenantId via the
// Collection contract, so cross-tenant rows can never leak.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type {
  Environment,
  EnvironmentStatus,
  EnvironmentType,
} from "./mission-control-hardening-types";

export async function listEnvironments(tenantId: string): Promise<Environment[]> {
  return (await db.environments.list(tenantId)).sort((a, b) => a.key.localeCompare(b.key));
}

export async function getEnvironmentByKey(
  tenantId: string,
  key: string,
): Promise<Environment | undefined> {
  return await db.environments.find(tenantId, (e) => e.key === key);
}

export async function getEnvironmentById(
  tenantId: string,
  environmentId: string,
): Promise<Environment | undefined> {
  return await db.environments.get(tenantId, environmentId);
}

export async function createEnvironment(input: {
  tenantId: string;
  key: string;
  name: string;
  environmentType: EnvironmentType;
  status?: EnvironmentStatus;
  config?: Record<string, unknown>;
}): Promise<Environment> {
  const existing = await getEnvironmentByKey(input.tenantId, input.key);
  if (existing) return existing;
  return await db.environments.insert({
    id: id("env"),
    tenantId: input.tenantId,
    key: input.key,
    name: input.name,
    environmentType: input.environmentType,
    status: input.status ?? "active",
    config: input.config ?? {},
    createdAt: now(),
  });
}

export async function setEnvironmentStatus(input: {
  tenantId: string;
  environmentId: string;
  status: EnvironmentStatus;
}): Promise<Environment> {
  const env = await db.environments.get(input.tenantId, input.environmentId);
  if (!env) throw new Error(`Environment not found: ${input.environmentId}`);
  return await db.environments.update(env.id, { status: input.status });
}
