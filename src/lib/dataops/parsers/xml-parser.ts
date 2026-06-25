import { XMLParser } from "fast-xml-parser";
import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { loadAssetBytes } from "./load-bytes";

/** Find the first array-valued property in the parsed tree (BFS). */
function findFirstArray(
  node: unknown,
): { key: string; items: unknown[] } | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const queue: Array<Record<string, unknown>> = [node as Record<string, unknown>];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [key, value] of Object.entries(current)) {
      if (Array.isArray(value)) return { key, items: value };
    }
    for (const value of Object.values(current)) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        queue.push(value as Record<string, unknown>);
      }
    }
  }
  return undefined;
}

export const xmlParser: ParserHandler = {
  key: "xml",
  supports: (asset: RawAsset) => asset.kind === "xml" || asset.kind === "html",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const rawText = (await loadAssetBytes(asset)).toString("utf8");
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(rawText) as Record<string, unknown>;
    const rootTag = Object.keys(parsed)[0] ?? null;

    const arr = findFirstArray(parsed);
    const records = (arr?.items ?? []).map((item, index) => ({
      recordType: "xml_record",
      payload:
        item !== null && typeof item === "object"
          ? (item as Record<string, unknown>)
          : { value: item },
      sourcePath: `${arr!.key}[${index}]`,
    }));

    return {
      document: {
        documentType: "xml_document",
        title: asset.fileName,
        textContent: rawText,
        metadata: { rootTag },
      },
      records,
    };
  },
};
