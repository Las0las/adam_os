// Phase 6 — rollback repository. Tenant-scoped persistence for rollback records.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { RollbackRecord, RollbackStatus } from "./mission-control-hardening-types";

export async function createRollbackRecord(input: {
  tenantId: string;
  releaseBundleId: string;
  rollbackReleaseBundleId?: string | null;
  reason: string;
  status?: RollbackStatus;
  requestedBy?: string | null;
}): Promise<RollbackRecord> {
  return await db.rollbackRecords.insert({
    id: id("rbk"),
    tenantId: input.tenantId,
    releaseBundleId: input.releaseBundleId,
    rollbackReleaseBundleId: input.rollbackReleaseBundleId ?? null,
    reason: input.reason,
    status: input.status ?? "requested",
    requestedBy: input.requestedBy ?? null,
    approvedBy: null,
    completedBy: null,
    createdAt: now(),
    completedAt: null,
  });
}

export async function updateRollbackStatus(input: {
  tenantId: string;
  rollbackId: string;
  status: RollbackStatus;
  approvedBy?: string | null;
  completedBy?: string | null;
}): Promise<RollbackRecord> {
  const record = await db.rollbackRecords.get(input.tenantId, input.rollbackId);
  if (!record) throw new Error(`Rollback record not found: ${input.rollbackId}`);
  const patch: Partial<RollbackRecord> = { status: input.status };
  if (input.approvedBy !== undefined) patch.approvedBy = input.approvedBy;
  if (input.completedBy !== undefined) patch.completedBy = input.completedBy;
  if (input.status === "completed") patch.completedAt = now();
  return await db.rollbackRecords.update(record.id, patch);
}

export async function getRollbackRecord(
  tenantId: string,
  rollbackId: string,
): Promise<RollbackRecord | undefined> {
  return await db.rollbackRecords.get(tenantId, rollbackId);
}

export async function listRollbackRecords(tenantId: string): Promise<RollbackRecord[]> {
  return (await db.rollbackRecords.list(tenantId)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
