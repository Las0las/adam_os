import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getLatencySummary } from "@/lib/aiops/observability/ai-usage-service";
import { listRuntimeTraces } from "@/lib/aiops/observability/runtime-trace-service";

export const dynamic = "force-dynamic";

// GET /api/aiops/observability/latency
export async function GET() {
  const ctx = await appContext();
  const [summary, traces] = await Promise.all([
    getLatencySummary(ctx.tenantId, 24),
    listRuntimeTraces(ctx.tenantId, { limit: 50 }),
  ]);
  return ok({ summary, traces });
}
