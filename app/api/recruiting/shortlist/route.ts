import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runCandidateFitWorkflow } from "@/lib/domains/recruiting/recruiting-workflow-service";
import "@/lib/domains/recruiting/recruiting-seed-pack";

// POST /api/recruiting/shortlist  body: { candidateId, jobId, recipientUserId? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    candidateId?: string;
    jobId?: string;
    recipientUserId?: string;
  };
  if (!body.candidateId || !body.jobId) {
    return NextResponse.json({ error: "candidateId and jobId are required" }, { status: 400 });
  }
  const result = await runCandidateFitWorkflow(ctx, {
    candidateId: body.candidateId,
    jobId: body.jobId,
    recipientUserId: body.recipientUserId,
  });
  return NextResponse.json(result, { status: 200 });
}
