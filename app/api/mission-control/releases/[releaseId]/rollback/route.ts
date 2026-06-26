import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { requestRollback } from "@/lib/mission-control/deployments/rollback-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/releases/[releaseId]/rollback  body: { reason, emergency? }
export async function POST(request: Request, { params }: { params: { releaseId: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ reason?: string; emergency?: boolean }>(request);
  return run(() =>
    requestRollback(ctx, {
      releaseBundleId: params.releaseId,
      reason: body.reason ?? "",
      emergency: body.emergency,
    }),
  );
}
