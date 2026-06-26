import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listSyncRuns } from "@/lib/integrations/integration-sync-service";

export const dynamic = "force-dynamic";

// GET /api/integrations/[connectionId]/sync-runs
export async function GET(_request: Request, { params }: { params: { connectionId: string } }) {
  const ctx = await appContext();
  return ok(await listSyncRuns(ctx, params.connectionId));
}
