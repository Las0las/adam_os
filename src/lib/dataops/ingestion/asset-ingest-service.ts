// Live upload ingestion (§19). Writes bytes to storage, dedups by SHA-256
// checksum, records an ingestion batch, and inserts a tenant-scoped raw asset.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { sha256 } from "./checksum";
import { detectFileKind } from "./file-kind-detector";
import { writeBytes } from "./storage-service";
import type { ActorContext } from "@/types/platform";
import type { RawAsset, RawAssetKind } from "@/types/dataops";

const TEXT_KINDS: RawAssetKind[] = ["json", "csv", "txt", "xml", "html", "eml"];

export interface IngestUploadInput {
  fileName: string;
  mimeType?: string | null;
  bytes?: Buffer;
  content?: string;
  sourceId?: string | null;
  force?: boolean;
}

/** Ingest an uploaded blob into a raw asset, deduping by content checksum. */
export async function ingestUpload(
  ctx: ActorContext,
  input: IngestUploadInput,
): Promise<RawAsset> {
  requirePermission(ctx, "dataops.admin");

  const bytes = input.bytes ?? Buffer.from(input.content ?? "", "utf8");
  const checksumSha256 = sha256(bytes);

  if (!input.force) {
    const existing = await db.rawAssets.find(
      ctx.tenantId,
      (a) => a.checksumSha256 === checksumSha256,
    );
    if (existing) {
      await emitAudit(
        ctx,
        "dataops.asset.ingested",
        { type: "raw_asset", id: existing.id },
        { kind: existing.kind, checksum: checksumSha256, dedup: true },
      );
      return existing;
    }
  }

  const batch = await db.ingestionBatches.insert({
    id: id("batch"),
    tenantId: ctx.tenantId,
    sourceId: input.sourceId ?? null,
    status: "completed",
    metadata: { fileName: input.fileName },
    createdAt: now(),
    completedAt: now(),
  });

  const storagePath = await writeBytes(ctx.tenantId, input.fileName, bytes);
  const kind = detectFileKind(input.fileName, input.mimeType);

  const asset = await db.rawAssets.insert({
    id: id("asset"),
    tenantId: ctx.tenantId,
    sourceId: input.sourceId ?? null,
    kind,
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    checksumSha256,
    sizeBytes: bytes.length,
    parentAssetId: null,
    ingestionBatchId: batch.id,
    storagePath,
    content: TEXT_KINDS.includes(kind) ? bytes.toString("utf8") : null,
    metadata: {},
    createdAt: now(),
  });

  await emitAudit(
    ctx,
    "dataops.asset.ingested",
    { type: "raw_asset", id: asset.id },
    { kind: asset.kind, checksum: checksumSha256, dedup: false },
  );

  return asset;
}
