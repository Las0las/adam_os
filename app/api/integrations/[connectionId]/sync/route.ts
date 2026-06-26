import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { runSync } from "@/lib/integrations/integration-sync-service";
import type { SyncType } from "@/lib/integrations/integration-types";

export const dynamic = "force-dynamic";

const SyncSchema = z.object({ syncType: z.string().optional() });

// POST /api/integrations/[connectionId]/sync  body: { syncType? }
export async function POST(request: Request, { params }: { params: { connectionId: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, SyncSchema);
    return runSync(ctx, params.connectionId, (body.syncType as SyncType | undefined) ?? "incremental");
  });
}
