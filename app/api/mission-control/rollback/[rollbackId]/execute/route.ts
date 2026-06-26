import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { executeRollback } from "@/lib/mission-control/deployments/rollback-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/rollback/[rollbackId]/execute
export async function POST(_request: Request, { params }: { params: { rollbackId: string } }) {
  const ctx = await appContext();
  return run(() => executeRollback(ctx, { rollbackId: params.rollbackId }));
}
