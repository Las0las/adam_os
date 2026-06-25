import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import {
  runRetrievalEvals,
  runExtractionEvals,
  runResponseEvals,
} from "@/lib/aiops/evals/eval-runner";
import type { EvalCase } from "@/types/aiops";

export const dynamic = "force-dynamic";

// POST /api/aiops/evals/run  body: { suite: "retrieval"|"extraction"|"response", functionKey?, cases: EvalCase[] }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    suite?: "retrieval" | "extraction" | "response";
    functionKey?: string;
    cases?: EvalCase[];
  };
  const cases = body.cases ?? [];

  if (body.suite === "extraction" && body.functionKey) {
    return NextResponse.json(await runExtractionEvals(ctx, body.functionKey, cases));
  }
  if (body.suite === "response" && body.functionKey) {
    return NextResponse.json(await runResponseEvals(ctx, body.functionKey, cases));
  }
  const run = await runRetrievalEvals(ctx, cases);
  // Persisted for the observability/evals surfaces.
  void db.evalRuns.get(ctx.tenantId, run.id);
  return NextResponse.json(run);
}
