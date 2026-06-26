import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { importConfig } from "@/lib/setup/import-service";
import type { ConfigExport } from "@/lib/setup/export-service";

export const dynamic = "force-dynamic";

const ImportConfigSchema = z.object({
  config: z.record(z.unknown()),
  apply: z.boolean().optional(),
});

// POST /api/setup/import-config  body: { config, apply? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ImportConfigSchema);
    return importConfig(ctx, body.config as unknown as ConfigExport, { apply: body.apply });
  });
}
