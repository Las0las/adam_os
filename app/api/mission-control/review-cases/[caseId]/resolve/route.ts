import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { resolveReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { releaseApprovedAction } from "@/lib/mission-control/actions/action-service";
import {
  confirmCandidateDraft,
  rejectCandidateDraft,
  CANDIDATE_EXTRACTION_CASE_TYPE,
} from "@/lib/dataops/import/nl/candidate-extraction";

export const dynamic = "force-dynamic";

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

  // Candidate-extraction drafts need domain handling: approval must PROJECT the
  // proposed Candidate (and rejection discard it), not merely flip the case
  // status. confirm/reject project first, then resolve — so a failed projection
  // leaves the case open rather than approving with nothing created.
  const existing = await db.reviewCases.get(ctx.tenantId, params.caseId);
  if (existing?.caseType === CANDIDATE_EXTRACTION_CASE_TYPE && body.decision !== "resolved") {
    try {
      const candidate =
        body.decision === "approved"
          ? await confirmCandidateDraft(ctx, params.caseId, body.note)
          : (await rejectCandidateDraft(ctx, params.caseId, body.note), null);
      const reviewCase = await db.reviewCases.get(ctx.tenantId, params.caseId);
      return NextResponse.json({ reviewCase, candidate });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 422 },
      );
    }
  }

  const reviewCase = await resolveReviewCase(ctx, params.caseId, body.decision, body.note);
  const released =
    body.decision === "approved" ? await releaseApprovedAction(ctx, params.caseId) : null;
  return NextResponse.json({ reviewCase, released });
}
