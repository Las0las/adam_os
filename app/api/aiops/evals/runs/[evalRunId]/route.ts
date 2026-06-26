import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getEvalRun } from "@/lib/aiops/evals/eval-run-repository";
import { listCaseResults } from "@/lib/aiops/evals/eval-result-repository";

export const dynamic = "force-dynamic";

// GET /api/aiops/evals/runs/[evalRunId]
export async function GET(_request: Request, { params }: { params: { evalRunId: string } }) {
  const ctx = await appContext();
  const run = await getEvalRun(ctx.tenantId, params.evalRunId);
  if (!run) return fail("eval run not found", 404);
  const caseResults = await listCaseResults(ctx.tenantId, run.id);
  return ok({ run, caseResults });
}
