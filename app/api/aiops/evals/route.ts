import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listEvalSuites } from "@/lib/aiops/evals/eval-run-repository";

export const dynamic = "force-dynamic";

// GET /api/aiops/evals
export async function GET() {
  const ctx = await appContext();
  return ok(await listEvalSuites(ctx.tenantId));
}
