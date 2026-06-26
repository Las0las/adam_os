import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getCostSummary, listAiUsageEvents } from "@/lib/aiops/observability/ai-usage-service";

export const dynamic = "force-dynamic";

// GET /api/aiops/observability/costs
export async function GET() {
  const ctx = await appContext();
  const [summary, events] = await Promise.all([
    getCostSummary(ctx.tenantId, 24),
    listAiUsageEvents(ctx.tenantId, { limit: 50 }),
  ]);
  return ok({ summary, events });
}
