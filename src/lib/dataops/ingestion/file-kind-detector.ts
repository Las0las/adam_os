// File-kind detection for ingestion (§19). Resolves a RawAssetKind from the
// filename extension first, then falls back to the declared MIME type.

import type { RawAssetKind } from "@/types/dataops";

const EXTENSION_KIND: Record<string, RawAssetKind> = {
  json: "json",
  xml: "xml",
  csv: "csv",
  xlsx: "xlsx",
  xls: "xlsx",
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
  txt: "txt",
  text: "txt",
  md: "txt",
  eml: "eml",
  html: "html",
  htm: "html",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  tiff: "image",
};

const MIME_KIND: Array<[RegExp, RawAssetKind]> = [
  [/json/i, "json"],
  [/xml/i, "xml"],
  [/csv/i, "csv"],
  [/spreadsheetml|ms-excel|excel/i, "xlsx"],
  [/pdf/i, "pdf"],
  [/wordprocessingml|msword/i, "docx"],
  [/rfc822|message\/rfc822|\.eml/i, "eml"],
  [/html/i, "html"],
  [/^image\//i, "image"],
  [/^text\//i, "txt"],
];

/** Detect the canonical asset kind from a filename and optional MIME type. */
export function detectFileKind(fileName: string, mimeType?: string | null): RawAssetKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const byExt = EXTENSION_KIND[ext];
  if (byExt) return byExt;

  if (mimeType) {
    for (const [pattern, kind] of MIME_KIND) {
      if (pattern.test(mimeType)) return kind;
    }
  }

  return "unknown";
}
