// Import Adapter Framework. An adapter understands ONE source format and emits
// the canonical Recruiting IR. Detection + extraction operate on a format-neutral
// `ImportProbe` (sheets as arrays-of-arrays + asset metadata), so adapters never
// depend on the spreadsheet library directly and stay trivially unit-testable.
//
// Registration is additive: drop a new adapter (Bullhorn, Greenhouse, …) and
// register it; the ontology layer is untouched.

import type { ImportProvenance, RecruitingImportIR } from "./recruiting-ir";

/** One sheet/table of a source asset, normalized to rows of cells. */
export interface ImportSheet {
  name: string;
  rows: unknown[][];
}

/** Format-neutral view of a source asset handed to adapters for detection. */
export interface ImportProbe {
  fileName: string | null;
  sheets: ImportSheet[];
}

/**
 * Provenance the host (parser) establishes for the whole import run, before the
 * adapter runs. The adapter fills in `source`, `parserVersion`, `mappingVersion`
 * and the per-entity `sheetName`/`rowNumber`.
 */
export type ImportProvenanceBase = Pick<
  ImportProvenance,
  "importRunId" | "importedAt" | "originalFilename" | "workbookHash"
>;

export interface ImportAdapter {
  /** Stable adapter id, e.g. "linkedin_recruiter". */
  key: string;
  /** Source attribution stamped onto every emitted entity. */
  source: string;
  /** Cheap, side-effect-free check: can this adapter handle the probe? */
  detect(probe: ImportProbe): boolean;
  /** Extract the canonical IR. Only called when `detect` returned true. */
  extract(probe: ImportProbe, base: ImportProvenanceBase): RecruitingImportIR;
}

const registry: ImportAdapter[] = [];

export function registerImportAdapter(adapter: ImportAdapter): void {
  if (registry.some((a) => a.key === adapter.key)) return; // idempotent by key
  registry.push(adapter);
}

export function listImportAdapters(): ImportAdapter[] {
  return [...registry];
}

/** First adapter that claims the probe wins. Returns undefined for unknown
 *  formats, letting the caller fall back to generic parsing. */
export function detectImportAdapter(probe: ImportProbe): ImportAdapter | undefined {
  return registry.find((a) => a.detect(probe));
}

// ── shared cell helpers for adapters ────────────────────────────────────────

export function cellStr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export function cellNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Normalize a header label for tolerant matching: trim, collapse ws, lowercase. */
export function normHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Index of the first non-empty row (the header row); -1 if the sheet is blank. */
export function headerRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (Array.isArray(r) && r.some((c) => c != null && String(c).trim() !== "")) return i;
  }
  return -1;
}

/** camelCase fallback key for an unrecognized header so no column is dropped. */
export function fallbackKey(label: string): string {
  const parts = label.split(/[^a-z0-9]+/i).filter(Boolean);
  if (parts.length === 0) return "field";
  return parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("");
}

/** The normalized header labels present in a sheet (for detection). */
export function sheetHeaders(sheet: ImportSheet): Set<string> {
  const hi = headerRowIndex(sheet.rows);
  if (hi === -1) return new Set();
  return new Set((sheet.rows[hi] ?? []).map((c) => normHeader(c)));
}

/** Project a sheet's data rows to canonical-keyed objects. Columns resolve to a
 *  known key via `columnMap` (matched on the normalized label) or a camelCase
 *  fallback; the first column with a given key wins. `rowNumber` is 1-based for
 *  human-facing provenance. Fully-empty rows are skipped. */
export function mapDataRows(
  sheet: ImportSheet,
  columnMap: Record<string, string>,
): Array<{ row: Record<string, unknown>; rowNumber: number }> {
  const hi = headerRowIndex(sheet.rows);
  if (hi === -1) return [];
  const rawHeader = (sheet.rows[hi] ?? []).map((c) => String(c ?? ""));
  const keys = rawHeader.map((h) => columnMap[normHeader(h)] ?? fallbackKey(h || "col"));

  const out: Array<{ row: Record<string, unknown>; rowNumber: number }> = [];
  for (let i = hi + 1; i < sheet.rows.length; i += 1) {
    const cells = sheet.rows[i];
    if (!Array.isArray(cells)) continue;
    if (!cells.some((c) => c != null && String(c).trim() !== "")) continue;
    const row: Record<string, unknown> = {};
    keys.forEach((k, idx) => {
      if (k in row) return;
      row[k] = cells[idx] ?? null;
    });
    out.push({ row, rowNumber: i + 1 });
  }
  return out;
}
