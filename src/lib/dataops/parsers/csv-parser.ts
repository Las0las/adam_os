import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";

/** Minimal RFC-4180-ish CSV parser (quoted fields, embedded commas/quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key.trim()] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

export const csvParser: ParserHandler = {
  key: "csv",
  supports: (asset: RawAsset) => asset.kind === "csv",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const records = parseCsv(asset.content ?? "");
    return {
      document: {
        documentType: "csv",
        title: asset.fileName,
        metadata: { rowCount: records.length },
      },
      records: records.map((payload, index) => ({
        recordType: "csv_row",
        payload,
        sourcePath: `row[${index}]`,
      })),
    };
  },
};
