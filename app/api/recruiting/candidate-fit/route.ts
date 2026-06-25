import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import "@/lib/domains/recruiting/recruiting-seed-pack";

export const dynamic = "force-dynamic";

// POST /api/recruiting/candidate-fit  body: { candidateId, jobId }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    candidateId?: string;
    jobId?: string;
  };
  if (!body.candidateId || !body.jobId) {
    return NextResponse.json({ error: "candidateId and jobId are required" }, { status: 400 });
  }
  const run = await runFunction(ctx, "recruiting.candidate_fit_summary", {
    candidateId: body.candidateId,
    jobId: body.jobId,
  });
  return NextResponse.json(run, { status: run.status === "failed" ? 422 : 200 });
}
