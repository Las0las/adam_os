// Shared adapter-projection step used by every format parser (xlsx, csv, …).
// Given a format-neutral probe, detect a recruiting import adapter; if one
// claims the workbook, extract the canonical IR and emit one submission record
// per application plus an import-level document. Returns null when no adapter
// matches, so the caller falls back to its generic projection.

import { createHash } from "node:crypto";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { detectImportAdapter, type ImportProbe } from "./import-adapter";
import {
  RECRUITING_SUBMISSION_RECORD_TYPE,
  type IRCandidate,
  type IRJob,
} from "./recruiting-ir";
import type { CanonicalParseOutput } from "@/lib/dataops/parsers/parser-types";

export interface ImportSource {
  fileName: string | null;
  sheetNames: string[];
  /** Bytes or text the file hash is computed over (workbook fingerprint). */
  hashInput: Buffer | string;
}

export function runRecruitingImport(
  probe: ImportProbe,
  source: ImportSource,
): CanonicalParseOutput | null {
  const adapter = detectImportAdapter(probe);
  if (!adapter) return null;

  const workbookHash = createHash("sha256").update(source.hashInput).digest("hex");
  const ir = adapter.extract(probe, {
    importRunId: id("import"),
    importedAt: now(),
    originalFilename: source.fileName,
    workbookHash,
  });

  const jobsByKey = new Map<string, IRJob>(ir.jobs.map((j) => [j.externalKey, j]));
  const candidatesByKey = new Map<string, IRCandidate>(ir.candidates.map((c) => [c.externalKey, c]));

  const records: NonNullable<CanonicalParseOutput["records"]> = [];
  for (const submission of ir.submissions) {
    const job = jobsByKey.get(submission.jobKey);
    const candidate = candidatesByKey.get(submission.candidateKey);
    if (!job || !candidate) continue;
    records.push({
      recordType: RECRUITING_SUBMISSION_RECORD_TYPE,
      payload: { job, candidate, submission } as unknown as Record<string, unknown>,
      sourcePath: `sheet:${submission.provenance.sheetName};row:${submission.provenance.rowNumber}`,
    });
  }

  const overview = (ir.jobs[0]?.metadata.overview ?? {}) as Record<string, unknown>;
  return {
    document: {
      documentType: `${adapter.source}_export`,
      title: source.fileName,
      metadata: {
        sheets: source.sheetNames,
        source: adapter.source,
        importRunId: ir.provenance.importRunId,
        workbookHash,
        overview,
        counts: {
          jobs: ir.jobs.length,
          candidates: ir.candidates.length,
          submissions: ir.submissions.length,
        },
      },
    },
    records,
  };
}
