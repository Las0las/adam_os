import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";

/** Parses a JSON asset into canonical records (one per top-level array item). */
export const jsonParser: ParserHandler = {
  key: "json",
  supports: (asset: RawAsset) => asset.kind === "json",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const parsed = JSON.parse(asset.content ?? "null") as unknown;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return {
      document: {
        documentType: "json",
        title: asset.fileName,
        textContent: asset.content ?? null,
        metadata: { recordCount: items.length },
      },
      records: items.map((item, index) => ({
        recordType: "json_record",
        payload: (item ?? {}) as Record<string, unknown>,
        sourcePath: `$[${index}]`,
      })),
    };
  },
};
