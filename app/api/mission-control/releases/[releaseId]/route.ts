import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getReleaseBundleDetail } from "@/lib/mission-control/deployments/release-bundle-service";
import { validateReleaseBundle } from "@/lib/mission-control/deployments/release-validation-service";

export const dynamic = "force-dynamic";

// GET /api/mission-control/releases/[releaseId]
export async function GET(_request: Request, { params }: { params: { releaseId: string } }) {
  const ctx = await appContext();
  const detail = await getReleaseBundleDetail(ctx, params.releaseId);
  if (!detail) return fail("release not found", 404);
  const validation = await validateReleaseBundle(ctx, params.releaseId);
  return ok({ ...detail, validation });
}
