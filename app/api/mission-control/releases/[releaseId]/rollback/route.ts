import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { requestRollback } from "@/lib/mission-control/deployments/rollback-service";

export const dynamic = "force-dynamic";

const RollbackSchema = z.object({
  reason: z.string().optional(),
  emergency: z.boolean().optional(),
});

// POST /api/mission-control/releases/[releaseId]/rollback  body: { reason, emergency? }
export async function POST(request: Request, { params }: { params: { releaseId: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, RollbackSchema);
    return requestRollback(ctx, {
      releaseBundleId: params.releaseId,
      reason: body.reason ?? "",
      emergency: body.emergency,
    });
  });
}
