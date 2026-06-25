// Filesystem byte storage for raw assets (§19). Parsers read bytes back from
// the returned absolute path. Layout: <root>/<tenantId>/<id>-<fileName>.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { id } from "@/lib/lawrence-core/utils/ids";

function storageRoot(): string {
  return process.env.LAWRENCE_STORAGE_DIR ?? path.join(os.tmpdir(), "lawrence-storage");
}

/** Strip path separators / traversal from a filename so it is safe to join. */
function safeName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^A-Za-z0-9._-]+/g, "_");
  return base.length > 0 ? base : "asset";
}

/** Persist bytes for a tenant; returns the absolute path written to. */
export async function writeBytes(
  tenantId: string,
  fileName: string,
  bytes: Buffer,
): Promise<string> {
  const dir = path.join(storageRoot(), tenantId);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, `${id("blob")}-${safeName(fileName)}`);
  await fs.writeFile(target, bytes);
  return target;
}

/** Read raw bytes from a stored path. */
export async function readBytes(storagePath: string): Promise<Buffer> {
  return await fs.readFile(storagePath);
}

/** Read a stored blob as UTF-8 text. */
export async function readText(storagePath: string): Promise<string> {
  return await fs.readFile(storagePath, "utf8");
}
