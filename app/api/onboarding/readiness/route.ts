import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runFunction } from "@/lib/aiops/functions/function-runner";

export const dynamic = "force-dynamic";
// Side-effect import: ensure the onboarding function/actions are registered.
import "@/lib/domains/onboarding/onboarding-seed-pack";

// POST /api/onboarding/readiness
// body: { onboardingCaseId }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    onboardingCaseId?: string;
  };
  if (!body.onboardingCaseId) {
    return NextResponse.json(
      { error: "missing onboardingCaseId" },
      { status: 400 },
    );
  }
  const run = await runFunction(ctx, "onboarding.readiness_summary", {
    onboardingCaseId: body.onboardingCaseId,
  });
  return NextResponse.json(run);
}
