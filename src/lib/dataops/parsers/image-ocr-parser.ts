import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";

/** Placeholder image handler — OCR is unsupported in this foundation. */
export const imageOcrParser: ParserHandler = {
  key: "image",
  supports: (asset: RawAsset) => asset.kind === "image",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    return {
      document: {
        documentType: "image",
        title: asset.fileName,
        textContent: "",
        metadata: { extractionStatus: "unsupported" },
      },
    };
  },
};
