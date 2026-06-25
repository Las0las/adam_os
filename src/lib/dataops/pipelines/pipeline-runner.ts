// Pipeline runner (§18 execution path). Executes the canonical flow:
//   raw asset -> parse -> canonical doc/records -> transforms -> chunk/embed
//   -> ontology mappers -> ontology objects/links -> lineage/audit.
// This is the deterministic spine of DataOps; AI nodes (extract/classify) are
// delegated to AIOps functions and are out of scope for the deterministic run.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { resolveParser } from "../parsers/parser-registry";
import { resolveTransform } from "../transforms/transform-registry";
import { indexEvidence } from "../evidence/chunking-service";
import { emitLineage } from "../lineage/lineage-service";
import { resolveObjectMapper } from "../ontology/object-mapper-registry";
import { writeBytes } from "../ingestion/storage-service";
import type { CanonicalParseOutput } from "../parsers/parser-types";
import type { ActorContext } from "@/types/platform";
import type {
  RawAsset,
  PipelineRun,
  CanonicalDocument,
  CanonicalRecord,
} from "@/types/dataops";

export interface PipelineRunResult {
  run: PipelineRun;
  document?: CanonicalDocument;
  records: CanonicalRecord[];
  ontologyObjectIds: string[];
  chunkIds: string[];
}

export interface RunPipelineOptions {
  /** Transform steps applied to canonical record payloads, in order. */
  transforms?: Array<{ key: string; config: Record<string, unknown> }>;
  /** Build evidence chunks from the canonical document text. */
  buildEvidence?: boolean;
  /** Ontology mapper key to project records into ontology objects. */
  ontologyMapper?: string;
  pipelineId?: string;
}

export async function runAssetPipeline(
  ctx: ActorContext,
  asset: RawAsset,
  options: RunPipelineOptions = {},
): Promise<PipelineRunResult> {
  requirePermission(ctx, "dataops.admin");

  const run = await db.pipelineRuns.insert({
    id: id("run"),
    tenantId: ctx.tenantId,
    pipelineId: options.pipelineId ?? "ad_hoc",
    status: "running",
    startedAt: now(),
    finishedAt: null,
    stats: {},
    error: null,
  });

  try {
    // 1–4. Detect + parse -> canonical document + records.
    const parser = resolveParser(asset);
    if (!parser) throw new Error(`No parser for asset kind: ${asset.kind}`);
    const parsed = await parser.parse(asset);

    let document: CanonicalDocument | undefined;
    if (parsed.document) {
      document = await db.canonicalDocuments.insert({
        id: id("doc"),
        tenantId: ctx.tenantId,
        rawAssetId: asset.id,
        documentType: parsed.document.documentType,
        title: parsed.document.title ?? null,
        textContent: parsed.document.textContent ?? null,
        metadata: parsed.document.metadata ?? {},
        createdAt: now(),
      });
      await emitLineage(ctx, {
        pipelineRunId: run.id,
        kind: "parse",
        from: { type: "raw_asset", id: asset.id },
        to: { type: "canonical_document", id: document.id },
      });
    }

    let records: CanonicalRecord[] = await Promise.all(
      (parsed.records ?? []).map((r) =>
        db.canonicalRecords.insert({
          id: id("rec"),
          tenantId: ctx.tenantId,
          documentId: document?.id ?? "",
          recordType: r.recordType,
          payload: r.payload,
          sourcePath: r.sourcePath ?? null,
          createdAt: now(),
        }),
      ),
    );

    // 4b. Recurse into child assets (e.g. EML attachments), depth-limited.
    if (parsed.childAssets?.length) {
      await processChildAssets(ctx, run.id, asset, parsed.childAssets, 1);
    }

    // 5. Apply deterministic transforms over record payloads.
    if (options.transforms?.length) {
      let rows = records.map((r) => r.payload);
      for (const step of options.transforms) {
        const transform = resolveTransform(step.key);
        if (!transform) throw new Error(`Unknown transform: ${step.key}`);
        rows = (await transform.run({ rows, config: step.config }, ctx)).rows;
      }
      records = await Promise.all(
        records.map((r, i) => db.canonicalRecords.update(r.id, { payload: rows[i] ?? r.payload })),
      );
    }

    // 6–7. Optionally extract evidence chunks + embeddings from doc text.
    const chunkIds: string[] = [];
    if (options.buildEvidence && document?.textContent) {
      const chunks = await indexEvidence(
        ctx,
        { objectType: "canonical_document", objectId: document.id },
        document.textContent,
        { documentTitle: document.title },
      );
      for (const c of chunks) {
        chunkIds.push(c.id);
        await emitLineage(ctx, {
          pipelineRunId: run.id,
          kind: "chunk",
          from: { type: "canonical_document", id: document.id },
          to: { type: "evidence_chunk", id: c.id },
        });
      }
    }

    // 8–9. Ontology projection.
    const ontologyObjectIds: string[] = [];
    if (options.ontologyMapper) {
      const mapper = resolveObjectMapper(options.ontologyMapper);
      if (!mapper) throw new Error(`Unknown ontology mapper: ${options.ontologyMapper}`);
      for (const record of records) {
        const objects = await mapper.map(ctx, record);
        for (const obj of objects) {
          ontologyObjectIds.push(obj.id);
          await emitLineage(ctx, {
            pipelineRunId: run.id,
            kind: "project",
            from: { type: "canonical_record", id: record.id },
            to: { type: obj.objectType, id: obj.id },
          });
        }
      }
    }

    // 10. Finalise.
    const finished = await db.pipelineRuns.update(run.id, {
      status: "completed",
      finishedAt: now(),
      stats: {
        records: records.length,
        chunks: chunkIds.length,
        ontologyObjects: ontologyObjectIds.length,
      },
    });
    await emitAudit(ctx, "dataops.pipeline.run", { type: "pipeline_run", id: run.id }, finished.stats);

    return { run: finished, document, records, ontologyObjectIds, chunkIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await db.pipelineRuns.update(run.id, {
      status: "failed",
      finishedAt: now(),
      error: message,
    });
    await emitAudit(ctx, "dataops.pipeline.run.failed", { type: "pipeline_run", id: run.id }, { error: message });
    return { run: failed, records: [], ontologyObjectIds: [], chunkIds: [] };
  }
}

const MAX_CHILD_DEPTH = 3;
const CHILD_TEXT_KINDS = new Set(["json", "csv", "txt", "xml", "html", "eml"]);

/**
 * Persist child assets discovered during parsing (e.g. EML attachments) as
 * raw_assets parented to `parent`, emit raw_asset→raw_asset lineage, then parse
 * each child into its own canonical document/records (recursing up to
 * MAX_CHILD_DEPTH).
 */
async function processChildAssets(
  ctx: ActorContext,
  pipelineRunId: string,
  parent: RawAsset,
  children: NonNullable<CanonicalParseOutput["childAssets"]>,
  depth: number,
): Promise<void> {
  if (depth > MAX_CHILD_DEPTH) return;

  for (const child of children) {
    const isAttachment = child.metadata?.["attachment"] === true;
    // Attachment payloads arrive base64-encoded; decode to bytes.
    const bytes =
      child.content != null
        ? Buffer.from(child.content, isAttachment ? "base64" : "utf8")
        : Buffer.from("");

    let storagePath: string | null = child.storagePath ?? null;
    let content: string | null = null;
    if (CHILD_TEXT_KINDS.has(child.kind)) {
      content = bytes.toString("utf8");
    } else if (!storagePath) {
      storagePath = await writeBytes(ctx.tenantId, child.fileName, bytes);
    }

    const childAsset = await db.rawAssets.insert({
      id: id("asset"),
      tenantId: ctx.tenantId,
      sourceId: parent.sourceId ?? null,
      kind: child.kind,
      fileName: child.fileName,
      mimeType: child.mimeType ?? null,
      checksumSha256: null,
      sizeBytes: bytes.length,
      parentAssetId: parent.id,
      ingestionBatchId: parent.ingestionBatchId ?? null,
      storagePath,
      content,
      metadata: child.metadata ?? {},
      createdAt: now(),
    });

    await emitLineage(ctx, {
      pipelineRunId,
      kind: "child_asset",
      from: { type: "raw_asset", id: parent.id },
      to: { type: "raw_asset", id: childAsset.id },
    });

    const parser = resolveParser(childAsset);
    if (!parser) continue;
    const parsed = await parser.parse(childAsset);

    let childDoc: CanonicalDocument | undefined;
    if (parsed.document) {
      childDoc = await db.canonicalDocuments.insert({
        id: id("doc"),
        tenantId: ctx.tenantId,
        rawAssetId: childAsset.id,
        documentType: parsed.document.documentType,
        title: parsed.document.title ?? null,
        textContent: parsed.document.textContent ?? null,
        metadata: parsed.document.metadata ?? {},
        createdAt: now(),
      });
      await emitLineage(ctx, {
        pipelineRunId,
        kind: "parse",
        from: { type: "raw_asset", id: childAsset.id },
        to: { type: "canonical_document", id: childDoc.id },
      });
    }

    await Promise.all(
      (parsed.records ?? []).map((r) =>
        db.canonicalRecords.insert({
          id: id("rec"),
          tenantId: ctx.tenantId,
          documentId: childDoc?.id ?? "",
          recordType: r.recordType,
          payload: r.payload,
          sourcePath: r.sourcePath ?? null,
          createdAt: now(),
        }),
      ),
    );

    if (parsed.childAssets?.length) {
      await processChildAssets(ctx, pipelineRunId, childAsset, parsed.childAssets, depth + 1);
    }
  }
}
