import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { executeAction } from "@/lib/mission-control/actions/action-service";

// POST /api/mission-control/actions/:key/execute
// body: { input, object?, idempotencyKey?, approvalExempt? }
export async function POST(
  request: Request,
  { params }: { params: { key: string } },
) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    input?: Record<string, unknown>;
    object?: { type: string; id: string };
    idempotencyKey?: string;
    approvalExempt?: boolean;
  };
  const exec = await executeAction(ctx, {
    actionKey: params.key,
    input: body.input ?? {},
    object: body.object,
    idempotencyKey: body.idempotencyKey,
    approvalExempt: body.approvalExempt,
  });
  return NextResponse.json(exec);
}
