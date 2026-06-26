import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { installMissionControlGovernance } from "@/lib/mission-control/runtime/mission-control-seed";
import { listApprovalPolicies } from "@/lib/mission-control/runtime/approval-repository";

export const dynamic = "force-dynamic";

// POST /api/setup/create-default-approval-policies
export async function POST() {
  const ctx = await appContext();
  return run(async () => {
    await installMissionControlGovernance(ctx);
    return await listApprovalPolicies(ctx.tenantId);
  });
}
