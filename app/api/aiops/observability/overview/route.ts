import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getObservabilityOverview } from "@/lib/aiops/observability/observability-overview-service";

export const dynamic = "force-dynamic";

// GET /api/aiops/observability/overview
export async function GET() {
  const ctx = await appContext();
  return ok(await getObservabilityOverview(ctx));
}
