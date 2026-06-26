import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listLearningSignals } from "@/lib/aiops/learning/learning-signal-service";
import type { LearningSignalStatus } from "@/lib/aiops/learning/learning-types";

export const dynamic = "force-dynamic";

// GET /api/learning/signals?status=open
export async function GET(request: Request) {
  const ctx = await appContext();
  const statusParam = new URL(request.url).searchParams.get("status") as LearningSignalStatus | null;
  return ok(await listLearningSignals(ctx.tenantId, statusParam ? { status: statusParam } : {}));
}
