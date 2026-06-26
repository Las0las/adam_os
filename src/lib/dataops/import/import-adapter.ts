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
