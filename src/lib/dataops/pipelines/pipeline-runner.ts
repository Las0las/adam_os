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

  const run = db.pipelineRuns.insert({
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
      document = db.canonicalDocuments.insert({
        id: id("doc"),
        tenantId: ctx.tenantId,
        rawAssetId: asset.id,
        documentType: parsed.document.documentType,
        title: parsed.document.title ?? null,
        textContent: parsed.document.textContent ?? null,
        metadata: parsed.document.metadata ?? {},
        createdAt: now(),
      });
      emitLineage(ctx, {
        pipelineRunId: run.id,
        kind: "parse",
        from: { type: "raw_asset", id: asset.id },
        to: { type: "canonical_document", id: document.id },
      });
    }

    let records: CanonicalRecord[] = (parsed.records ?? []).map((r) =>
      db.canonicalRecords.insert({
        id: id("rec"),
        tenantId: ctx.tenantId,
        documentId: document?.id ?? "",
        recordType: r.recordType,
        payload: r.payload,
        sourcePath: r.sourcePath ?? null,
        createdAt: now(),
      }),
    );

    // 5. Apply deterministic transforms over record payloads.
    if (options.transforms?.length) {
      let rows = records.map((r) => r.payload);
      for (const step of options.transforms) {
        const transform = resolveTransform(step.key);
        if (!transform) throw new Error(`Unknown transform: ${step.key}`);
        rows = (await transform.run({ rows, config: step.config }, ctx)).rows;
      }
      records = records.map((r, i) => db.canonicalRecords.update(r.id, { payload: rows[i] ?? r.payload }));
    }

    // 6–7. Optionally extract evidence chunks + embeddings from doc text.
    const chunkIds: string[] = [];
    if (options.buildEvidence && document?.textContent) {
      const chunks = indexEvidence(
        ctx,
        { objectType: "canonical_document", objectId: document.id },
        document.textContent,
        { documentTitle: document.title },
      );
      for (const c of chunks) {
        chunkIds.push(c.id);
        emitLineage(ctx, {
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
        const objects = mapper.map(ctx, record);
        for (const obj of objects) {
          ontologyObjectIds.push(obj.id);
          emitLineage(ctx, {
            pipelineRunId: run.id,
            kind: "project",
            from: { type: "canonical_record", id: record.id },
            to: { type: obj.objectType, id: obj.id },
          });
        }
      }
    }

    // 10. Finalise.
    const finished = db.pipelineRuns.update(run.id, {
      status: "completed",
      finishedAt: now(),
      stats: {
        records: records.length,
        chunks: chunkIds.length,
        ontologyObjects: ontologyObjectIds.length,
      },
    });
    emitAudit(ctx, "dataops.pipeline.run", { type: "pipeline_run", id: run.id }, finished.stats);

    return { run: finished, document, records, ontologyObjectIds, chunkIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = db.pipelineRuns.update(run.id, {
      status: "failed",
      finishedAt: now(),
      error: message,
    });
    emitAudit(ctx, "dataops.pipeline.run.failed", { type: "pipeline_run", id: run.id }, { error: message });
    return { run: failed, records: [], ontologyObjectIds: [], chunkIds: [] };
  }
}
