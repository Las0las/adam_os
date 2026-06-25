// Source registry + raw asset ingestion (§14, §19).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { checksum } from "@/lib/lawrence-core/utils/checksum";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import type { Source, SourceKind, RawAsset, RawAssetKind } from "@/types/dataops";

export function registerSource(
  ctx: ActorContext,
  input: { name: string; kind: SourceKind; config?: Record<string, unknown> },
): Source {
  requirePermission(ctx, "dataops.admin");
  const source = db.sources.insert({
    id: id("src"),
    tenantId: ctx.tenantId,
    name: input.name,
    kind: input.kind,
    config: input.config ?? {},
    createdAt: now(),
  });
  emitAudit(ctx, "dataops.source.register", { type: "source", id: source.id }, { kind: input.kind });
  return source;
}

const EXTENSION_KIND: Record<string, RawAssetKind> = {
  json: "json",
  xml: "xml",
  xlsx: "xlsx",
  csv: "csv",
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  eml: "eml",
  html: "html",
};

export function detectKind(fileName: string, explicit?: RawAssetKind): RawAssetKind {
  if (explicit) return explicit;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_KIND[ext] ?? "unknown";
}

export function ingestAsset(
  ctx: ActorContext,
  input: {
    fileName: string;
    content: string;
    sourceId?: string | null;
    kind?: RawAssetKind;
    mimeType?: string | null;
    metadata?: Record<string, unknown>;
  },
): RawAsset {
  requirePermission(ctx, "dataops.admin");
  const asset = db.rawAssets.insert({
    id: id("asset"),
    tenantId: ctx.tenantId,
    sourceId: input.sourceId ?? null,
    kind: detectKind(input.fileName, input.kind),
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    checksumSha256: checksum(input.content),
    sizeBytes: input.content.length,
    parentAssetId: null,
    ingestionBatchId: null,
    content: input.content,
    metadata: input.metadata ?? {},
    createdAt: now(),
  });
  emitAudit(ctx, "dataops.asset.ingest", { type: "raw_asset", id: asset.id }, { kind: asset.kind });
  return asset;
}
