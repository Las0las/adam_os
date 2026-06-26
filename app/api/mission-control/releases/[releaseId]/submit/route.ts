import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { submitReleaseForApproval } from "@/lib/mission-control/deployments/release-bundle-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/releases/[releaseId]/submit
export async function POST(_request: Request, { params }: { params: { releaseId: string } }) {
  const ctx = await appContext();
  return run(() => submitReleaseForApproval(ctx, params.releaseId));
}
