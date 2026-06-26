import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { runAllHealthChecks } from "@/lib/mission-control/runtime/health-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/runtime/health/run
export async function POST() {
  const ctx = await appContext();
  return run(() => runAllHealthChecks(ctx));
}
