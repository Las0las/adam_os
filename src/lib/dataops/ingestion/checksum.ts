// SHA-256 content checksum for ingestion dedup (§19). Uses node:crypto so the
// digest is stable across processes (unlike the in-memory FNV stand-in).

import { createHash } from "node:crypto";

/** Hex SHA-256 of the given bytes or string. */
export function sha256(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}
