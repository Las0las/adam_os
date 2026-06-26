import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listActiveKillSwitches } from "@/lib/mission-control/runtime/kill-switch-repository";

export const dynamic = "force-dynamic";

// GET /api/mission-control/kill-switches
export async function GET() {
  const ctx = await appContext();
  return ok(await listActiveKillSwitches(ctx.tenantId));
}
