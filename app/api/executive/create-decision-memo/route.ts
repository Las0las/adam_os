import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import "@/lib/domains/executive/executive-seed-pack";

// POST /api/executive/create-decision-memo
// body: { input, object?, idempotencyKey?, approvalExempt? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    input?: Record<string, unknown>;
    object?: { type: string; id: string };
    idempotencyKey?: string;
    approvalExempt?: boolean;
  };
  const exec = await executeAction(ctx, {
    actionKey: "executive.create_decision_memo",
    input: body.input ?? {},
    object: body.object,
    idempotencyKey: body.idempotencyKey,
    approvalExempt: body.approvalExempt ?? true,
  });
  return NextResponse.json(exec);
}
