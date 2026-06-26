import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { runSync } from "@/lib/integrations/integration-sync-service";
import type { SyncType } from "@/lib/integrations/integration-types";

export const dynamic = "force-dynamic";

// POST /api/integrations/[connectionId]/sync  body: { syncType? }
export async function POST(request: Request, { params }: { params: { connectionId: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ syncType?: SyncType }>(request);
  return run(() => runSync(ctx, params.connectionId, body.syncType ?? "incremental"));
}
