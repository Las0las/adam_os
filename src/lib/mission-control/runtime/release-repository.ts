// Phase 6 — release bundle repository. Tenant-scoped persistence for hardened
// release bundles and their items. Status transitions go through the typed
// mark* helpers so the deployment services never hand-write status strings.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type {
  ReleaseBundle,
  ReleaseBundleItem,
  ReleaseItemChangeType,
  ReleaseItemType,
  ReleaseStatus,
  ReleaseType,
} from "./mission-control-hardening-types";

export async function createReleaseBundle(input: {
  tenantId: string;
  key: string;
  name: string;
  description?: string | null;
  releaseType: ReleaseType;
  sourceEnvironmentId?: string | null;
  targetEnvironmentId?: string | null;
  payload?: Record<string, unknown>;
  createdBy?: string | null;
  rollbackOfReleaseId?: string | null;
  status?: ReleaseStatus;
}): Promise<ReleaseBundle> {
  return await db.hardenedReleases.insert({
    id: id("rbndl"),
    tenantId: input.tenantId,
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    status: input.status ?? "draft",
    releaseType: input.releaseType,
    sourceEnvironmentId: input.sourceEnvironmentId ?? null,
    targetEnvironmentId: input.targetEnvironmentId ?? null,
    payload: input.payload ?? {},
    createdBy: input.createdBy ?? null,
    approvedBy: null,
    promotedBy: null,
    rollbackOfReleaseId: input.rollbackOfReleaseId ?? null,
    validation: null,
    createdAt: now(),
    approvedAt: null,
    promotedAt: null,
    rolledBackAt: null,
  });
}

export async function addReleaseBundleItem(input: {
  tenantId: string;
  releaseBundleId: string;
  itemType: ReleaseItemType;
  itemId?: string | null;
  itemKey?: string | null;
  itemVersion?: number | null;
  changeType?: ReleaseItemChangeType;
  payload?: Record<string, unknown>;
}): Promise<ReleaseBundleItem> {
  return await db.releaseBundleItems.insert({
    id: id("rbitem"),
    tenantId: input.tenantId,
    releaseBundleId: input.releaseBundleId,
    itemType: input.itemType,
    itemId: input.itemId ?? null,
    itemKey: input.itemKey ?? null,
    itemVersion: input.itemVersion ?? null,
    changeType: input.changeType ?? "update",
    payload: input.payload ?? {},
    previousSnapshot: null,
    createdAt: now(),
  });
}

export async function listReleaseBundleItems(
  tenantId: string,
  releaseBundleId: string,
): Promise<ReleaseBundleItem[]> {
  return await db.releaseBundleItems.list(tenantId, (i) => i.releaseBundleId === releaseBundleId);
}

export async function getReleaseBundle(
  tenantId: string,
  releaseBundleId: string,
): Promise<ReleaseBundle | undefined> {
  return await db.hardenedReleases.get(tenantId, releaseBundleId);
}

export async function listReleaseBundles(
  tenantId: string,
  filters: { status?: ReleaseStatus; targetEnvironmentId?: string } = {},
): Promise<ReleaseBundle[]> {
  return (
    await db.hardenedReleases.list(tenantId, (r) => {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.targetEnvironmentId && r.targetEnvironmentId !== filters.targetEnvironmentId)
        return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateReleaseStatus(input: {
  tenantId: string;
  releaseBundleId: string;
  status: ReleaseStatus;
  validation?: ReleaseBundle["validation"];
}): Promise<ReleaseBundle> {
  const release = await requireRelease(input.tenantId, input.releaseBundleId);
  const patch: Partial<ReleaseBundle> = { status: input.status };
  if (input.validation !== undefined) patch.validation = input.validation;
  return await db.hardenedReleases.update(release.id, patch);
}

export async function markReleaseApproved(input: {
  tenantId: string;
  releaseBundleId: string;
  approvedBy?: string | null;
}): Promise<ReleaseBundle> {
  const release = await requireRelease(input.tenantId, input.releaseBundleId);
  return await db.hardenedReleases.update(release.id, {
    status: "approved",
    approvedBy: input.approvedBy ?? null,
    approvedAt: now(),
  });
}

export async function markReleasePromoted(input: {
  tenantId: string;
  releaseBundleId: string;
  promotedBy?: string | null;
}): Promise<ReleaseBundle> {
  const release = await requireRelease(input.tenantId, input.releaseBundleId);
  return await db.hardenedReleases.update(release.id, {
    status: "promoted",
    promotedBy: input.promotedBy ?? null,
    promotedAt: now(),
  });
}

export async function markReleaseFailed(input: {
  tenantId: string;
  releaseBundleId: string;
}): Promise<ReleaseBundle> {
  const release = await requireRelease(input.tenantId, input.releaseBundleId);
  return await db.hardenedReleases.update(release.id, { status: "failed" });
}

export async function markReleaseRolledBack(input: {
  tenantId: string;
  releaseBundleId: string;
}): Promise<ReleaseBundle> {
  const release = await requireRelease(input.tenantId, input.releaseBundleId);
  return await db.hardenedReleases.update(release.id, {
    status: "rolled_back",
    rolledBackAt: now(),
  });
}

async function requireRelease(tenantId: string, releaseBundleId: string): Promise<ReleaseBundle> {
  const release = await db.hardenedReleases.get(tenantId, releaseBundleId);
  if (!release) throw new Error(`Release bundle not found: ${releaseBundleId}`);
  return release;
}
