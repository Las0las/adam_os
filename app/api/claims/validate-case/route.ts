import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import "@/lib/domains/claims/claims-seed-pack";

export const dynamic = "force-dynamic";

// POST /api/claims/validate-case  body: { validationCaseId }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as { validationCaseId?: string };
  if (!body.validationCaseId) {
    return NextResponse.json({ error: "validationCaseId is required" }, { status: 400 });
  }
  const run = await runFunction(ctx, "claims.validation_case_evidence_summary", {
    validationCaseId: body.validationCaseId,
  });
  return NextResponse.json(run, { status: run.status === "failed" ? 422 : 200 });
}
