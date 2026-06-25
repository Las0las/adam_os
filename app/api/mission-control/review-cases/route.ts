import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { listReviewCases, openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import type { ReviewCase } from "@/types/mission-control";

// GET /api/mission-control/review-cases?status=open
export async function GET(request: Request) {
  const ctx = await appContext();
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  const cases = await listReviewCases(ctx, status as ReviewCase["status"] | undefined);
  return NextResponse.json(cases);
}

// POST /api/mission-control/review-cases
// body: { caseType, subject?, severity?, summary? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    caseType: string;
    subject?: { type: string; id: string };
    severity?: ReviewCase["severity"];
    summary?: string;
  };
  if (!body.caseType) {
    return NextResponse.json({ error: "missing caseType" }, { status: 400 });
  }
  const rc = await openReviewCase(ctx, {
    caseType: body.caseType,
    subject: body.subject,
    severity: body.severity,
    summary: body.summary,
  });
  return NextResponse.json(rc);
}
