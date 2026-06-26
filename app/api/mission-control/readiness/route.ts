import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getProductionReadiness } from "@/lib/mission-control/readiness/readiness-service";

export const dynamic = "force-dynamic";

// GET /api/mission-control/readiness
export async function GET() {
  const ctx = await appContext();
  return ok(await getProductionReadiness(ctx));
}
