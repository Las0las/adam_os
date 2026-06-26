// Phase 10 — data classification service. Records and resolves the effective
// (most-sensitive) classification for an object or field.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import type { ActorContext } from "@/types/platform";
import type {
  ClassificationSource,
  DataClassification,
  DataClassificationRecord,
} from "./data-classification-types";

// Most → least sensitive, for resolving an effective classification.
const SENSITIVITY: DataClassification[] = [
  "credential",
  "restricted",
  "health",
  "legal",
  "financial",
  "pii",
  "confidential",
  "internal",
  "public",
];

export function moreSensitive(a: DataClassification, b: DataClassification): DataClassification {
  return SENSITIVITY.indexOf(a) <= SENSITIVITY.indexOf(b) ? a : b;
}

export async function classifyObject(
  ctx: ActorContext,
  input: {
    objectType: string;
    objectId: string;
    fieldPath?: string | null;
    classification: DataClassification;
    source?: ClassificationSource;
    confidence?: number | null;
  },
): Promise<DataClassificationRecord> {
  requirePermission(ctx, "security.classification_manage");
  const record = await db.dataClassifications.insert({
    id: id("dclass"),
    tenantId: ctx.tenantId,
    objectType: input.objectType,
    objectId: input.objectId,
    fieldPath: input.fieldPath ?? null,
    classification: input.classification,
    source: input.source ?? "manual",
    confidence: input.confidence ?? null,
    createdBy: ctx.actorUserId ?? null,
    createdAt: now(),
  });
  await emitAudit(ctx, "security.classification.created", { type: input.objectType, id: input.objectId }, {
    classification: input.classification,
    source: record.source,
  });
  return record;
}

/** Classify without a permission gate — for the detector pipeline (source=detector). */
export async function recordDetectedClassification(
  tenantId: string,
  input: {
    objectType?: string | null;
    objectId?: string | null;
    fieldPath?: string | null;
    classification: DataClassification;
    confidence?: number | null;
  },
): Promise<DataClassificationRecord> {
  return await db.dataClassifications.insert({
    id: id("dclass"),
    tenantId,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    fieldPath: input.fieldPath ?? null,
    classification: input.classification,
    source: "detector",
    confidence: input.confidence ?? null,
    createdBy: null,
    createdAt: now(),
  });
}

export async function listClassificationsForObject(
  tenantId: string,
  objectType: string,
  objectId: string,
): Promise<DataClassificationRecord[]> {
  return await db.dataClassifications.list(
    tenantId,
    (c) => c.objectType === objectType && c.objectId === objectId,
  );
}

export async function getEffectiveClassification(
  tenantId: string,
  objectType: string,
  objectId: string,
  fieldPath?: string,
): Promise<DataClassification | null> {
  const records = await db.dataClassifications.list(
    tenantId,
    (c) =>
      c.objectType === objectType &&
      c.objectId === objectId &&
      (fieldPath ? c.fieldPath === fieldPath : true),
  );
  if (records.length === 0) return null;
  return records.map((r) => r.classification).reduce((a, b) => moreSensitive(a, b));
}
