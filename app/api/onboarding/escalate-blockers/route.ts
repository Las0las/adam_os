import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runOnboardingReadinessWorkflow } from "@/lib/domains/onboarding/onboarding-workflow-service";
// Side-effect import: ensure the onboarding function/actions are registered.
import "@/lib/domains/onboarding/onboarding-seed-pack";

// POST /api/onboarding/escalate-blockers
// body: { onboardingCaseId, recipientUserId? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    onboardingCaseId?: string;
    recipientUserId?: string;
  };
  if (!body.onboardingCaseId) {
    return NextResponse.json(
      { error: "missing onboardingCaseId" },
      { status: 400 },
    );
  }
  const result = await runOnboardingReadinessWorkflow(ctx, {
    onboardingCaseId: body.onboardingCaseId,
    recipientUserId: body.recipientUserId,
  });
  return NextResponse.json(result);
}
