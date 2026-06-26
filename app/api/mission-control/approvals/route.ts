import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listPendingApprovals } from "@/lib/mission-control/runtime/approval-repository";

export const dynamic = "force-dynamic";

// GET /api/mission-control/approvals
export async function GET() {
  const ctx = await appContext();
  return ok(await listPendingApprovals(ctx.tenantId));
}
