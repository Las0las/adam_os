import * as XLSX from "xlsx";
import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { loadAssetBytes } from "./load-bytes";

export const xlsxParser: ParserHandler = {
  key: "xlsx",
  supports: (asset: RawAsset) => asset.kind === "xlsx",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const bytes = await loadAssetBytes(asset);
    const workbook = XLSX.read(bytes, { type: "buffer" });

    const records: NonNullable<CanonicalParseOutput["records"]> = [];
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      sheets.push(sheetName);
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

      // First non-empty row is the header.
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
          sourcePath: `sheet:${sheetName};row:${i}`,
        });
      }
    }

    return {
      document: {
        documentType: "spreadsheet",
        title: asset.fileName,
        metadata: { sheets },
      },
      records,
    };
  },
};
