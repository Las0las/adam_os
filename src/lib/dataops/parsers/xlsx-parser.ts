import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { loadAssetBytes } from "./load-bytes";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import {
  detectImportAdapter,
  type ImportProbe,
  type ImportSheet,
} from "@/lib/dataops/import/import-adapter";
import {
  RECRUITING_SUBMISSION_RECORD_TYPE,
  type IRCandidate,
  type IRJob,
} from "@/lib/dataops/import/recruiting-ir";
// Side-effect: registers the recruiting import adapters with the registry.
import "@/lib/dataops/import/import-bootstrap";

/** Read every sheet as arrays-of-arrays (header:1) for both the generic path
 *  and the import-adapter probe. */
function readSheets(workbook: XLSX.WorkBook): ImportSheet[] {
  const sheets: ImportSheet[] = [];
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    sheets.push({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) });
  }
  return sheets;
}

/** Generic projection: first non-empty row is the header; each later row is a
 *  `spreadsheet_row` record. Unchanged behavior for non-recruiting workbooks. */
function genericRecords(sheets: ImportSheet[]): NonNullable<CanonicalParseOutput["records"]> {
  const records: NonNullable<CanonicalParseOutput["records"]> = [];
  for (const { name, rows } of sheets) {
    let headerIndex = -1;
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      if (Array.isArray(r) && r.some((c) => c !== null && c !== undefined && c !== "")) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) continue;

    const header = (rows[headerIndex] ?? []).map((c) => String(c ?? ""));
    for (let i = headerIndex + 1; i < rows.length; i += 1) {
      const cells = rows[i];
      if (!Array.isArray(cells)) continue;
      if (!cells.some((c) => c !== null && c !== undefined && c !== "")) continue;
      const payload: Record<string, unknown> = {};
      header.forEach((key, idx) => {
        payload[key] = cells[idx] ?? null;
      });
      records.push({
        recordType: "spreadsheet_row",
        payload,
        sourcePath: `sheet:${name};row:${i}`,
      });
    }
  }
  return records;
}

export const xlsxParser: ParserHandler = {
  key: "xlsx",
  supports: (asset: RawAsset) => asset.kind === "xlsx",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const bytes = await loadAssetBytes(asset);
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const sheets = readSheets(workbook);
    const sheetNames = sheets.map((s) => s.name);

    // Format detection: a recruiting import adapter (LinkedIn Recruiter, future
    // ATS exports) takes precedence over the generic spreadsheet projection.
    const probe: ImportProbe = { fileName: asset.fileName, sheets };
    const adapter = detectImportAdapter(probe);
    if (adapter) {
      const workbookHash = createHash("sha256").update(bytes).digest("hex");
      const ir = adapter.extract(probe, {
        importRunId: id("import"),
        importedAt: now(),
        originalFilename: asset.fileName,
        workbookHash,
      });

      const jobsByKey = new Map<string, IRJob>(ir.jobs.map((j) => [j.externalKey, j]));
      const candidatesByKey = new Map<string, IRCandidate>(
        ir.candidates.map((c) => [c.externalKey, c]),
      );

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
          title: asset.fileName,
          metadata: {
            sheets: sheetNames,
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

    return {
      document: {
        documentType: "spreadsheet",
        title: asset.fileName,
        metadata: { sheets: sheetNames },
      },
      records: genericRecords(sheets),
    };
  },
};
