import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";

/**
 * Fallback parser for free-text / pdf / docx / eml / html assets. In this
 * foundation it treats content as already-extracted text; production swaps in
 * real PDF extraction / OCR / EML attachment recursion (§52) behind this key.
 */
export const textParser: ParserHandler = {
  key: "text",
  supports: (asset: RawAsset) =>
    ["txt", "pdf", "docx", "eml", "html", "unknown"].includes(asset.kind),
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    return {
      document: {
        documentType: asset.kind,
        title: asset.fileName,
        textContent: asset.content ?? "",
        metadata: { chars: (asset.content ?? "").length },
      },
    };
  },
};
