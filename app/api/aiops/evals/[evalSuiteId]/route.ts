import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getEvalSuite, listEvalRuns } from "@/lib/aiops/evals/eval-run-repository";

export const dynamic = "force-dynamic";

// GET /api/aiops/evals/[evalSuiteId]
export async function GET(_request: Request, { params }: { params: { evalSuiteId: string } }) {
  const ctx = await appContext();
  const suite = await getEvalSuite(ctx.tenantId, params.evalSuiteId);
  if (!suite) return fail("eval suite not found", 404);
  const runs = await listEvalRuns(ctx.tenantId, { suiteId: suite.id });
  return ok({ suite, runs });
}
