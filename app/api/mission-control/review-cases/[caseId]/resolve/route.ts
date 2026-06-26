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
import {
  confirmJobDraft,
  rejectJobDraft,
  JOB_EXTRACTION_CASE_TYPE,
} from "@/lib/dataops/import/nl/job-extraction";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject } from "@/types/dataops";

export const dynamic = "force-dynamic";

// Extraction case types whose approval must PROJECT an object (and rejection
// discard it), not merely flip the case status. Each confirm/reject projects
// first, then resolves — so a failed projection leaves the case open rather than
// approving with nothing created. The projected object is returned under `result`.
const EXTRACTION_HANDLERS: Record<
  string,
  {
    confirm: (ctx: ActorContext, caseId: string, note?: string) => Promise<OntologyObject>;
    reject: (ctx: ActorContext, caseId: string, note?: string) => Promise<void>;
  }
> = {
  [CANDIDATE_EXTRACTION_CASE_TYPE]: { confirm: confirmCandidateDraft, reject: rejectCandidateDraft },
  [JOB_EXTRACTION_CASE_TYPE]: { confirm: confirmJobDraft, reject: rejectJobDraft },
};

// POST /api/mission-control/review-cases/:caseId/resolve
// body: { decision: "approved" | "rejected" | "resolved", note? }
export async function POST(request: Request, { params }: { params: { caseId: string } }) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    decision: "approved" | "rejected" | "resolved";
    note?: string;
  };
  if (!body.decision) {
    return NextResponse.json({ error: "missing decision" }, { status: 400 });
  }

  const existing = await db.reviewCases.get(ctx.tenantId, params.caseId);
  const handler = existing ? EXTRACTION_HANDLERS[existing.caseType] : undefined;
  if (handler && body.decision !== "resolved") {
    try {
      const result =
        body.decision === "approved"
          ? await handler.confirm(ctx, params.caseId, body.note)
          : (await handler.reject(ctx, params.caseId, body.note), null);
      const reviewCase = await db.reviewCases.get(ctx.tenantId, params.caseId);
      return NextResponse.json({ reviewCase, result });
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
