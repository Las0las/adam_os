import mammoth from "mammoth";
import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { loadAssetBytes } from "./load-bytes";

export const docxParser: ParserHandler = {
  key: "docx",
  supports: (asset: RawAsset) => asset.kind === "docx",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const bytes = await loadAssetBytes(asset);
    const result = await mammoth.extractRawText({ buffer: bytes });
    return {
      document: {
        documentType: "docx_document",
        title: asset.fileName,
        textContent: result.value,
        metadata: { chars: result.value.length },
      },
    };
  },
};
