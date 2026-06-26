import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getDemoRun } from "@/lib/demo/demo-trace-service";

export const dynamic = "force-dynamic";

// GET /api/demos/runs/[demoRunId]
export async function GET(_request: Request, { params }: { params: { demoRunId: string } }) {
  const ctx = await appContext();
  const run = await getDemoRun(ctx, params.demoRunId);
  if (!run) return fail("demo run not found", 404);
  return ok(run);
}
