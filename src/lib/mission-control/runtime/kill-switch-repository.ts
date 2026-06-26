// Phase 6 — kill switch repository. Tenant-scoped persistence for component
// kill switches, keyed on (componentType, componentKey, environmentId).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { KillSwitch, RuntimeComponentType } from "./mission-control-hardening-types";

function sameEnv(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

export async function getKillSwitch(
  tenantId: string,
  componentType: RuntimeComponentType,
  componentKey: string,
  environmentId?: string | null,
): Promise<KillSwitch | undefined> {
  return await db.killSwitches.find(
    tenantId,
    (k) =>
      k.componentType === componentType &&
      k.componentKey === componentKey &&
      sameEnv(k.environmentId, environmentId),
  );
}

export async function enableKillSwitch(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
  reason: string;
  enabledBy?: string | null;
}): Promise<KillSwitch> {
  const existing = await getKillSwitch(
    input.tenantId,
    input.componentType,
    input.componentKey,
    input.environmentId,
  );
  if (existing) {
    return await db.killSwitches.update(existing.id, {
      enabled: true,
      reason: input.reason,
      enabledBy: input.enabledBy ?? null,
      enabledAt: now(),
      disabledBy: null,
      disabledAt: null,
    });
  }
  return await db.killSwitches.insert({
    id: id("kill"),
    tenantId: input.tenantId,
    componentType: input.componentType,
    componentKey: input.componentKey,
    environmentId: input.environmentId ?? null,
    enabled: true,
    reason: input.reason,
    enabledBy: input.enabledBy ?? null,
    disabledBy: null,
    enabledAt: now(),
    disabledAt: null,
    createdAt: now(),
  });
}

export async function disableKillSwitch(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
  reason?: string | null;
  disabledBy?: string | null;
}): Promise<KillSwitch | undefined> {
  const existing = await getKillSwitch(
    input.tenantId,
    input.componentType,
    input.componentKey,
    input.environmentId,
  );
  if (!existing) return undefined;
  return await db.killSwitches.update(existing.id, {
    enabled: false,
    reason: input.reason ?? existing.reason,
    disabledBy: input.disabledBy ?? null,
    disabledAt: now(),
  });
}

export async function listActiveKillSwitches(tenantId: string): Promise<KillSwitch[]> {
  return await db.killSwitches.list(tenantId, (k) => k.enabled);
}
