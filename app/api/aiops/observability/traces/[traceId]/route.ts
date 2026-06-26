import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getRuntimeTrace } from "@/lib/aiops/observability/runtime-trace-service";

export const dynamic = "force-dynamic";

// GET /api/aiops/observability/traces/[traceId]
export async function GET(_request: Request, { params }: { params: { traceId: string } }) {
  const ctx = await appContext();
  const trace = await getRuntimeTrace(ctx.tenantId, params.traceId);
  if (!trace) return fail("trace not found", 404);
  return ok(trace);
}
