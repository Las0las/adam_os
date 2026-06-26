import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { runEvalSuite } from "@/lib/aiops/evals/eval-suite-runner";
import {
  runRetrievalEvals,
  runExtractionEvals,
  runResponseEvals,
} from "@/lib/aiops/evals/eval-runner";
import type { EvalCase } from "@/types/aiops";

export const dynamic = "force-dynamic";

// POST /api/aiops/evals/run
//  - Phase 7: { evalSuiteId } runs a stored suite via the productionized runner.
//  - Legacy:  { suite, functionKey?, cases } runs ad-hoc cases.
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    evalSuiteId?: string;
    suite?: "retrieval" | "extraction" | "response";
    functionKey?: string;
    cases?: EvalCase[];
  };

  if (body.evalSuiteId) {
    try {
      const result = await runEvalSuite(ctx, body.evalSuiteId, { actorUserId: ctx.actorUserId });
      return NextResponse.json({ ok: true, data: result });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 400 },
      );
    }
  }

  const cases = body.cases ?? [];
  if (body.suite === "extraction" && body.functionKey) {
    return NextResponse.json({ ok: true, data: await runExtractionEvals(ctx, body.functionKey, cases) });
  }
  if (body.suite === "response" && body.functionKey) {
    return NextResponse.json({ ok: true, data: await runResponseEvals(ctx, body.functionKey, cases) });
  }
  const run = await runRetrievalEvals(ctx, cases);
  void db.evalRuns.get(ctx.tenantId, run.id);
  return NextResponse.json({ ok: true, data: run });
}
