import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getMissionControlOverview } from "@/lib/mission-control/runtime/runtime-overview-service";

export const dynamic = "force-dynamic";

// GET /api/mission-control/runtime/overview
export async function GET() {
  const ctx = await appContext();
  return ok(await getMissionControlOverview(ctx));
}
