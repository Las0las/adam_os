import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import "@/lib/domains/claims/claims-seed-pack";

export const dynamic = "force-dynamic";

// POST /api/claims/create-finding  body: ExecuteAction input for the
// claims.create_validation_finding action. No logic in the route — thin call
// straight through to the action engine.
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const exec = await executeAction(ctx, {
    actionKey: "claims.create_validation_finding",
    input: body,
    approvalExempt: true,
  });
  return NextResponse.json(exec, { status: exec.status === "failed" ? 422 : 200 });
}
