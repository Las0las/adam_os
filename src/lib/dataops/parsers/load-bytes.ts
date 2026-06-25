// Shared byte loader for binary-capable parsers: prefer stored bytes, else the
// inline text content (utf8).

import { readBytes } from "../ingestion/storage-service";
import type { RawAsset } from "@/types/dataops";

export async function loadAssetBytes(asset: RawAsset): Promise<Buffer> {
  if (asset.storagePath) return await readBytes(asset.storagePath);
  return Buffer.from(asset.content ?? "", "utf8");
}
