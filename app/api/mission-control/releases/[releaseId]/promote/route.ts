import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { promoteRelease } from "@/lib/mission-control/deployments/release-promotion-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/releases/[releaseId]/promote
export async function POST(_request: Request, { params }: { params: { releaseId: string } }) {
  const ctx = await appContext();
  return run(() => promoteRelease(ctx, params.releaseId));
}
