// Parser registry contract (§17).

import type { RawAsset, RawAssetKind } from "@/types/dataops";

export interface CanonicalParseOutput {
  document?: {
    documentType: string;
    title?: string | null;
    textContent?: string | null;
    metadata?: Record<string, unknown>;
  };
  records?: Array<{
    recordType: string;
    payload: Record<string, unknown>;
    sourcePath?: string | null;
  }>;
  childAssets?: Array<{
    kind: RawAssetKind;
    fileName: string;
    mimeType?: string | null;
    bytesRef?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ParserHandler {
  key: string;
  supports(asset: RawAsset): boolean;
  parse(asset: RawAsset): Promise<CanonicalParseOutput>;
}
