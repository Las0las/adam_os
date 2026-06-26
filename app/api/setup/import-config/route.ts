import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { importConfig } from "@/lib/setup/import-service";
import type { ConfigExport } from "@/lib/setup/export-service";

export const dynamic = "force-dynamic";

// POST /api/setup/import-config  body: { config, apply? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{ config: ConfigExport; apply?: boolean }>(request);
  return run(() => importConfig(ctx, body.config, { apply: body.apply }));
}
