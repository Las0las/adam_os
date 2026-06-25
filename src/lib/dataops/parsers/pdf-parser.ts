import pdf from "pdf-parse/lib/pdf-parse.js";
import type { ParserHandler, CanonicalParseOutput } from "./parser-types";
import type { RawAsset } from "@/types/dataops";
import { loadAssetBytes } from "./load-bytes";

export const pdfParser: ParserHandler = {
  key: "pdf",
  supports: (asset: RawAsset) => asset.kind === "pdf",
  async parse(asset: RawAsset): Promise<CanonicalParseOutput> {
    const bytes = await loadAssetBytes(asset);
    try {
      const data = await pdf(bytes);
      const text = data.text ?? "";
      if (!text.trim()) {
        return {
          document: {
            documentType: "pdf_document",
            title: asset.fileName,
            textContent: "",
            metadata: { extractionStatus: "unavailable" },
          },
        };
      }
      return {
        document: {
          documentType: "pdf_document",
          title: asset.fileName,
          textContent: text,
          metadata: { pages: data.numpages, extractionStatus: "ok" },
        },
      };
    } catch {
      return {
        document: {
          documentType: "pdf_document",
          title: asset.fileName,
          textContent: "",
          metadata: { extractionStatus: "unavailable" },
        },
      };
    }
  },
};
