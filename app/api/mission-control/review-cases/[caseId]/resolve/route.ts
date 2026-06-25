import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { resolveReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { releaseApprovedAction } from "@/lib/mission-control/actions/action-service";

// POST /api/mission-control/review-cases/:caseId/resolve
// body: { decision: "approved" | "rejected" | "resolved", note? }
export async function POST(
  request: Request,
  { params }: { params: { caseId: string } },
) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    decision: "approved" | "rejected" | "resolved";
    note?: string;
  };
  if (!body.decision) {
    return NextResponse.json({ error: "missing decision" }, { status: 400 });
  }
  const reviewCase = await resolveReviewCase(ctx, params.caseId, body.decision, body.note);
  const released =
    body.decision === "approved" ? await releaseApprovedAction(ctx, params.caseId) : null;
  return NextResponse.json({ reviewCase, released });
}
